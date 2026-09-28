import { getProjectById, getServerById, listDeployments, listProjectEvents, listRoutesByDeployment } from "../db/repo";
import { scalingEngine } from "../scaling/engine";
import type { ProjectStatus, StatusFailure, StatusHistoryEntry } from "../types";
import { collectContainerStats } from "./container-stats";
import { getHttpErrorRate } from "./http-error-rate";
import { evaluateHealth } from "./health";

export const getProjectStatus = async (projectId: string, windowSeconds: number): Promise<ProjectStatus> => {
	const project = await getProjectById(projectId);
	if (!project) throw new Error(`Project ${projectId} not found`);

	const sinceIso = new Date(Date.now() - windowSeconds * 1000).toISOString();
	const deployments = await listDeployments(projectId);
	const running = deployments.filter((d) => d.status === "running");

	const [events, replicas, containers, http] = await Promise.all([
		listProjectEvents(projectId, sinceIso),
		scalingEngine.getProjectReplicas(projectId),
		collectContainerStats(deployments),
		getHttpErrorRate(projectId, windowSeconds),
	]);

	const serverId = running[0]?.serverId ?? project.serverId ?? null;
	const server = serverId && serverId !== "local" ? await getServerById(serverId).catch(() => null) : null;

	const routeErrors: string[] = [];
	for (const dep of running) {
		const routes = await listRoutesByDeployment(dep.id).catch(() => []);
		for (const route of routes) {
			if (route.lastError) routeErrors.push(route.lastError);
			else if (route.status === "failed") routeErrors.push(`Route ${route.hostname} is ${route.status}`);
		}
	}

	const failures: StatusFailure[] = events
		.filter((e) => e.type === "failed")
		.map((e) => ({
			deploymentId: e.deploymentId,
			message: e.message,
			commitSha: e.commitSha,
			sourceRef: e.sourceRef,
			finishedAt: e.finishedAt,
			recovered: e.deploymentStatus !== "failed",
			notifiedAt: e.sentAt,
		}));

	const history: StatusHistoryEntry[] = events.map((e) => ({
		deploymentId: e.deploymentId,
		type: e.type,
		message: e.message,
		at: e.createdAt,
	}));

	const health = evaluateHealth({
		server: server
			? {
					status: server.status,
					lastHeartbeatAgeMs: server.lastHeartbeat ? Date.now() - new Date(server.lastHeartbeat).getTime() : null,
				}
			: null,
		runningDeployments: running.length,
		hasDeployments: deployments.length > 0,
		routeErrors,
		http: { available: http.available, errorRate: http.errorRate },
	});

	return {
		projectId,
		windowSeconds,
		health,
		failures,
		history,
		replicas,
		resources: {
			server: server
				? {
						status: server.status,
						cpuUsedPercent: server.cpuUsedPercent,
						memoryTotalMb: server.memoryTotalMb,
						lastHeartbeatAt: server.lastHeartbeat,
					}
				: null,
			containers,
		},
		http,
	};
};
