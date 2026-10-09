import net from "node:net";
import {
	appendLog,
	createDeployment,
	getProjectById,
	getServerById,
	listDeployments,
	listProjects,
	listRoutes,
	updateDeploymentStatus,
	updateProject,
	updateRouteStatus,
} from "../db/repo";
import type { Server } from "../types";
import { config } from "../utils/config";
import { dockerBin } from "../utils/docker-bin";
import { dockerRunTry } from "../utils/docker-run";
import { getIngressServer, removeIngressRouteFile } from "../utils/ingress";
import { pickBestServer } from "../utils/server-default";
import { getContainerName } from "./runtime";

const CHECK_INTERVAL_MS = 30_000;
const GRACE_MS = 180_000;
const CONNECT_TIMEOUT_MS = 5_000;
const OLD_CONTAINER_CLEANUP_TIMEOUT_MS = 30_000;

const unreachableSince = new Map<string, number>();
const failingOver = new Set<string>();
const previouslyUnreachableServers = new Set<string>();
const lastFailoverAt = new Map<string, number>();
const rateLimitWarned = new Set<string>();

export const isServerReachable = (host: string, port: number = 22): Promise<boolean> =>
	new Promise((resolve) => {
		const socket = net.createConnection({ host, port });
		const finish = (reachable: boolean) => {
			resolve(reachable);
			socket.destroy();
		};
		socket.setTimeout(CONNECT_TIMEOUT_MS, () => finish(false));
		socket.once("connect", () => finish(true));
		socket.once("error", () => finish(false));
	});

const isFailoverDisabled = () => /^(1|true|yes)$/i.test(config.failoverDisabled);

const formatError = (error: unknown): string => {
	const message = error instanceof Error ? error.message : String(error);
	return message.trim() || "unknown error";
};

const bestEffort = (work: Promise<unknown>, label: string): Promise<void> =>
	Promise.race([
		work,
		new Promise<void>((_resolve, reject) => {
			const timer = setTimeout(() => reject(new Error("timed out")), OLD_CONTAINER_CLEANUP_TIMEOUT_MS);
			timer.unref?.();
		}),
	])
		.then(() => undefined)
		.catch((error) => {
			console.error(`[Failover] ${label} failed: ${formatError(error)}`);
		});

const removeOldServerContainers = (
	server: Server,
	deployment: { id: string; containerName?: string | null },
	project: { name?: string | null; id: string },
): Promise<void> => {
	const primaryName =
		deployment.containerName || getContainerName(deployment.id, project.name ?? undefined, project.id);
	const remove = async () => {
		const listed = await dockerRunTry(
			dockerBin,
			["ps", "-a", "--format", "{{.Names}}", "--filter", `name=deploy-${deployment.id}-replica-`],
			server,
		);
		const replicas = (listed ?? "")
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		const names = [primaryName, ...replicas];
		let removed = 0;
		for (const name of names) {
			await dockerRunTry(dockerBin, ["stop", "-t", "10", name], server);
			const result = await dockerRunTry(dockerBin, ["rm", "-f", name], server);
			if (result !== undefined) removed++;
		}
		console.log(
			`[Failover] old-container cleanup on ${server.name}: removed ${removed}/${names.length} (${names.join(", ")})`,
		);
	};
	return bestEffort(remove(), `old-container cleanup on ${server.name}`);
};

export const failoverProject = async (
	projectId: string,
	opts: { trigger?: "manual" | "auto" } = {},
): Promise<Awaited<ReturnType<typeof createDeployment>>> => {
	if (failingOver.has(projectId)) throw new Error("Failover already in progress for this project");
	const project = await getProjectById(projectId);
	if (!project) throw new Error("Project not found");
	if (!project.serverId) throw new Error("Project has no server assigned");
	if ((opts.trigger ?? "manual") === "auto") {
		const last = lastFailoverAt.get(projectId);
		const since = last ? Date.now() - last : Number.POSITIVE_INFINITY;
		if (since < config.failoverMinIntervalMs) {
			throw new Error(
				`Project failed over ${Math.round(since / 1000)}s ago — waiting ${config.failoverMinIntervalMs / 1000}s before another failover`,
			);
		}
	}
	const ingressServer = await getIngressServer();
	if (!ingressServer) throw new Error("No ingress server configured");
	const currentServer = await getServerById(project.serverId);
	if (currentServer?.mode !== "ssh") throw new Error("Failover only supports SSH project servers");

	const deployments = await listDeployments(projectId, 0, 1);
	const latest = deployments[0];
	if (!latest) throw new Error(`Project ${project.name ?? projectId} has no deployments to fail over`);
	if (latest.sourceType !== "git") throw new Error("Failover requires a Git deployment");

	failingOver.add(projectId);
	try {
		const targetId = await pickBestServer(null, project.serverId, ["ssh"]);
		if (!targetId || targetId === project.serverId || targetId === "local") {
			throw new Error(`No other healthy server available for failover of project ${project.name ?? projectId}`);
		}
		const targetServer = await getServerById(targetId);
		if (!targetServer) throw new Error("Target server not found");
		const targetReachable = await isServerReachable(targetServer.host, targetServer.port || 22);
		if (!targetReachable) {
			throw new Error(`Target server ${targetServer.name} is not reachable — failover aborted`);
		}

		const deployment = await createDeployment({
			projectId,
			serverId: targetId,
			sourceType: "git",
			sourceRef: latest.sourceRef,
			branch: latest.branch ?? undefined,
			commitSha: latest.commitSha ?? undefined,
			environment: latest.environment ?? undefined,
			clearCache: false,
		});
		await appendLog(deployment.id, "system", `Failover: redeploying to server ${targetServer.name}`);

		if (targetServer.mode === "ssh") {
			const { executorFor } = await import("../executors/dispatch");
			void executorFor("ssh")
				.deploy({ deployment, project, server: targetServer })
				.catch((error) => {
					console.error(`[Failover] Deployment ${deployment.id} failed: ${formatError(error)}`);
				});
		} else {
			const { queueRemoteDeployment } = await import("../agents/deployments");
			await queueRemoteDeployment(deployment, project);
		}

		await removeOldServerContainers(currentServer, latest, project);
		await updateProject(projectId, { serverId: targetId });
		lastFailoverAt.set(projectId, Date.now());
		rateLimitWarned.delete(projectId);
		unreachableSince.delete(projectId);
		await updateDeploymentStatus(latest.id, "inactive", {
			failureReason: `Superseded by failover deployment to ${targetServer.name}`,
		}).catch(() => {});
		console.log(
			`[Failover] project ${project.name ?? projectId} moved from ${currentServer.name} to ${targetServer.name} (deployment ${deployment.id})`,
		);
		return deployment;
	} finally {
		failingOver.delete(projectId);
	}
};

export const cleanupStaleRoutes = async (ingressServer: { id: string; mode: string }, serverId: string) => {
	const routes = await listRoutes(serverId);
	console.log(`[Failover] cleanupStaleRoutes: server=${serverId}, routes=${routes.length}`);
	if (!routes.length) return;
	for (const route of routes) {
		if (!route.projectId) continue;
		const project = await getProjectById(route.projectId);
		console.log(
			`[Failover] route ${route.hostname}: project=${route.projectId}, project.serverId=${project?.serverId}, serverId=${serverId}, match=${project?.serverId === serverId}`,
		);
		if (!project || project.serverId !== serverId) {
			console.log(
				`[Failover] Cleaning stale route ${route.hostname} for project ${route.projectId} (no longer on server ${serverId})`,
			);
			if (serverId !== ingressServer.id) {
				const routeServer = await getServerById(serverId);
				if (routeServer?.mode === "ssh") {
					await removeIngressRouteFile(routeServer, {
						hostname: route.hostname,
						routeFile: route.routeFile,
					}).catch(() => {});
				}
			}
			await updateRouteStatus(route.hostname, "removed", null, serverId).catch(() => {});
		}
	}
};

export const failoverMonitorTick = async () => {
	try {
		const ingressServer = await getIngressServer();
		if (!ingressServer) {
			unreachableSince.clear();
			previouslyUnreachableServers.clear();
			return;
		}
		const projects = await listProjects();
		const currentUnreachableServers = new Set<string>();
		const checks = projects
			.filter((p) => p.serverId && p.serverId !== "local" && p.serverId !== ingressServer.id)
			.map(async (project) => {
				const server = await getServerById(project.serverId!);
				if (server?.mode !== "ssh") return;
				const reachable = await isServerReachable(server.host, server.port || 22);
				if (reachable) {
					unreachableSince.delete(project.id);
					return;
				}
				currentUnreachableServers.add(project.serverId!);
				const firstSeen = unreachableSince.get(project.id) ?? Date.now();
				unreachableSince.set(project.id, firstSeen);
				if (Date.now() - firstSeen < GRACE_MS || failingOver.has(project.id)) return;
				console.log(
					`[Failover] Server ${server.name} unreachable for ${Math.round((Date.now() - firstSeen) / 1000)}s — failing over project ${project.name}`,
				);
				failoverProject(project.id, { trigger: "auto" }).catch((error) => {
					const message = formatError(error);
					if (message.includes("before another failover")) {
						if (!rateLimitWarned.has(project.id)) {
							rateLimitWarned.add(project.id);
							console.log(`[Failover] skipping project ${project.name}: ${message}`);
						}
						return;
					}
					console.error(`[Failover] Auto-failover for project ${project.id} failed: ${message}`);
					unreachableSince.delete(project.id);
				});
			});
		await Promise.all(checks);

		const recoveredServers = [...previouslyUnreachableServers].filter((id) => !currentUnreachableServers.has(id));
		for (const serverId of recoveredServers) {
			console.log(`[Failover] Server ${serverId} recovered — cleaning up stale routes`);
			await cleanupStaleRoutes(ingressServer, serverId).catch((error) => {
				console.error(`[Failover] Stale route cleanup for server ${serverId} failed: ${formatError(error)}`);
			});
		}
		previouslyUnreachableServers.clear();
		for (const id of currentUnreachableServers) previouslyUnreachableServers.add(id);
	} catch (error) {
		console.error(`[Failover] Monitor tick failed: ${formatError(error)}`);
	}
};

export const startFailoverMonitor = () => {
	if (isFailoverDisabled()) {
		console.log("[Failover] monitor disabled via FAILOVER_DISABLED");
		return null;
	}
	const handle = setInterval(failoverMonitorTick, CHECK_INTERVAL_MS);
	failoverMonitorTick();
	return handle;
};

export const failoverState = () => ({
	disabled: isFailoverDisabled(),
	unreachable: [...unreachableSince.entries()].map(([projectId, since]) => ({
		projectId,
		unreachableForMs: Date.now() - since,
	})),
	minIntervalMs: config.failoverMinIntervalMs,
});
