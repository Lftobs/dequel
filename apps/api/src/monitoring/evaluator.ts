import { eq } from "drizzle-orm";
import Redis from "ioredis";
import { getDb } from "../db/db-provider";
import { getProjectById, getScalingPolicy, listDeployments } from "../db/repo";
import { alerts } from "../db/schema";
import { scalingEngine } from "../scaling/engine";
import type { Deployment } from "../types";
import { config } from "../utils/config";
import { appBaseUrl } from "../utils/routes";
import { scalingGuard } from "./alert-guard";
import { getDeploymentContainerStats } from "./container-stats";
import { type Observation } from "./incident-policy";
import { createIncidentTracker, createRedisIncidentStore } from "./incident-tracker";
import { sendNotification } from "./notifier";
import type { AlertDetails } from "./templates";

class AlertEvaluator {
	private redis: Redis;
	private incidents: ReturnType<typeof createIncidentTracker>;
	private interval: ReturnType<typeof setInterval> | null = null;
	private ticking = false;

	constructor() {
		this.redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false });
		this.incidents = createIncidentTracker(createRedisIncidentStore(this.redis));
	}

	start() {
		if (this.interval) return;
		console.log("[Alerts] Evaluator started");
		this.tick();
		this.interval = setInterval(() => this.tick(), config.alertEvalIntervalMs);
	}

	stop() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
		this.redis.quit().catch(() => {});
	}

	private async tick() {
		if (this.ticking) return;
		this.ticking = true;
		try {
			const db = await getDb();
			const alertRows = await db.select().from(alerts).where(eq(alerts.enabled, true)).execute();
			if (!alertRows.length) return;

			const byProject = new Map<string, typeof alertRows>();
			for (const row of alertRows) {
				const arr = byProject.get(row.projectId) || [];
				arr.push(row);
				byProject.set(row.projectId, arr);
			}

			for (const [projectId, alerts] of byProject) {
				const project = await getProjectById(projectId);
				if (!project) continue;

				const deployments = await listDeployments(projectId);

				for (const alert of alerts) {
					try {
						await this.evaluate(alert, project, deployments);
					} catch (err) {
						console.error(`[Alerts] Evaluate error for alert ${alert.id}:`, err);
					}
				}
			}
		} catch (err) {
			console.error("[Alerts] Tick error:", err);
		} finally {
			this.ticking = false;
		}
	}

	private async evaluate(
		alert: any,
		project: { id: string; name: string; liveUrl?: string | null; cpuLimit?: number | null },
		deployments: Deployment[],
	) {
		const threshold = alert.threshold ?? (alert.type === "memory" ? 85 : 70);
		let { observation, currentValue } = await this.probe(alert.type, deployments, threshold);
		let scaling: AlertDetails["scaling"];

		if (observation.kind === "breach") {
			const guard = await this.evaluateScalingGuard(alert.type, project);
			if (guard.suppress) {
				observation = { kind: "no_data" };
			} else if (guard.suggestion) {
				scaling = {
					...guard.suggestion,
					url: `${appBaseUrl()}/project/${project.id}?tab=scaling`,
				};
			}
		}

		await this.incidents.step({
			alertId: alert.id,
			observation,
			send: async () => {
				const details = await this.buildDetails(alert.type, deployments);
				return sendNotification({
					channel: alert.channel,
					destination: alert.destination,
					projectName: project.name,
					alertType: alert.type,
					threshold,
					currentValue,
					details: {
						...details,
						scaling,
						projectUrl: `${appBaseUrl()}/project/${project.id}`,
					},
				});
			},
		});
	}

	private async evaluateScalingGuard(alertType: string, project: { id: string; cpuLimit?: number | null }) {
		const policy = await getScalingPolicy(project.id).catch(() => null);
		const canScale = !!policy?.enabled && !!project.cpuLimit && project.cpuLimit > 0;
		const replicas = canScale ? await scalingEngine.getProjectReplicas(project.id) : null;
		return scalingGuard(alertType, {
			policy: policy ? { enabled: policy.enabled, maxReplicas: policy.maxReplicas } : null,
			cpuLimit: project.cpuLimit ?? null,
			currentReplicas: replicas?.current ?? null,
		});
	}

	private async probe(
		alertType: string,
		deployments: Deployment[],
		threshold: number,
	): Promise<{ observation: Observation; currentValue: number }> {
		if (alertType === "downtime") {
			if (!deployments.length) return { observation: { kind: "no_data" }, currentValue: 0 };
			const running = deployments.some((d) => d.status === "running");
			return {
				observation: { kind: running ? "clear" : "breach" },
				currentValue: running ? 0 : 1,
			};
		}

		if (alertType !== "cpu" && alertType !== "memory") {
			return { observation: { kind: "no_data" }, currentValue: 0 };
		}

		let total = 0;
		let count = 0;
		for (const dep of deployments) {
			if (dep.status !== "running" || !dep.containerName) continue;
			const stats = await getDeploymentContainerStats(dep);
			if (stats) {
				total += alertType === "cpu" ? stats.cpuPercent : stats.memoryMb;
				count++;
			}
		}
		if (count === 0) return { observation: { kind: "no_data" }, currentValue: 0 };

		const value = total / count;
		return {
			observation: { kind: value > threshold ? "breach" : "clear" },
			currentValue: value,
		};
	}

	private async buildDetails(alertType: string, deployments: Deployment[]): Promise<AlertDetails> {
		const details: AlertDetails = {};

		if (alertType === "cpu" || alertType === "memory") {
			const containers: { name: string; value: number }[] = [];
			for (const dep of deployments) {
				if (dep.status !== "running" || !dep.containerName) continue;
				const stats = await getDeploymentContainerStats(dep);
				if (stats) {
					containers.push({
						name: dep.containerName,
						value: alertType === "cpu" ? stats.cpuPercent : stats.memoryMb,
					});
				}
			}
			details.containers = containers;
		}

		if (alertType === "downtime") {
			const lastFinished = deployments
				.filter((d) => d.finishedAt)
				.sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime())[0];
			details.lastRunningAt = lastFinished?.finishedAt ?? null;
		}

		return details;
	}
}

export const alertEvaluator = new AlertEvaluator();
