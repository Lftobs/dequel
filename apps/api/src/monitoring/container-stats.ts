import { getServerById } from "../db/repo";
import { run } from "../orchestrator/runtime";
import type { Deployment, Server } from "../types";
import { dockerBin } from "../utils/docker-bin";

const AGENT_OFFLINE_MS = 90_000;

export interface ContainerStats {
	cpuPercent: number;
	memoryMb: number;
}

const parseMemToMb = (mem: string): number => {
	const match = mem.match(/^([\d.]+)(\w+)$/);
	if (!match) return 0;
	const val = parseFloat(match[1]);
	switch (match[2]) {
		case "GiB":
		case "GB":
			return val * 1024;
		case "MiB":
		case "MB":
			return val;
		case "KiB":
		case "KB":
			return val / 1024;
		default:
			return val;
	}
};

const parseStatsJson = (statsJson: string): ContainerStats | null => {
	try {
		const stats = JSON.parse(statsJson);
		return {
			cpuPercent: parseFloat(stats.CPUPerc?.replace("%", "") ?? "0"),
			memoryMb: parseMemToMb(stats.MemUsage?.split("/")[0]?.trim() ?? "0B"),
		};
	} catch {
		return null;
	}
};

const isAgentOffline = (server: Server | null): boolean => {
	if (!server?.lastHeartbeat) return true;
	return Date.now() - new Date(server.lastHeartbeat).getTime() > AGENT_OFFLINE_MS;
};

export const getDeploymentContainerStats = async (deployment: Deployment): Promise<ContainerStats | null> => {
	const server =
		deployment.serverId && deployment.serverId !== "local"
			? await getServerById(deployment.serverId).catch(() => null)
			: null;
	const mode = server?.mode ?? "local";
	if (mode === "agent") {
		if (isAgentOffline(server)) return null;
		const { agentStatsCache } = await import("../agents/stats-cache");
		const containers = await agentStatsCache.get(server!.id);
		const stat = containers.get(deployment.containerName ?? "");
		return stat ? { cpuPercent: stat.cpuPercent, memoryMb: stat.memoryMb } : null;
	}
	try {
		const statsJson = await run(
			dockerBin,
			["stats", "--no-stream", "--format", "{{json .}}", deployment.containerName ?? ""],
			server,
		);
		return parseStatsJson(statsJson);
	} catch {
		return null;
	}
};

export const collectContainerStats = async (
	deployments: Deployment[],
): Promise<{ name: string; cpuPercent: number; memoryMb: number }[]> => {
	const out: { name: string; cpuPercent: number; memoryMb: number }[] = [];
	for (const dep of deployments) {
		if (dep.status !== "running" || !dep.containerName) continue;
		const stats = await getDeploymentContainerStats(dep);
		if (stats) out.push({ name: dep.containerName, cpuPercent: stats.cpuPercent, memoryMb: stats.memoryMb });
	}
	return out;
};
