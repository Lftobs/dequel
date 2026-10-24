import type { listServers } from "../db/repo";
import { isServerPreparing } from "../servers/prepare";

const repo = () => import("../db/repo");

const isServerHealthy = (s: Awaited<ReturnType<typeof listServers>>[number]): boolean => {
	if (isServerPreparing(s.id)) return false;
	if (s.mode === "agent") {
		return !!s.lastHeartbeat && Date.now() - new Date(s.lastHeartbeat).getTime() <= 90_000;
	}
	if (s.mode === "ssh") {
		return s.status === "connected";
	}
	return false;
};

const memoryLoadScore = (s: { memoryTotalMb: number | null; memoryUsedMb: number | null }): number => {
	if (!s.memoryTotalMb || s.memoryUsedMb === null || s.memoryUsedMb === undefined) return 0;
	return Math.min(1, Math.max(0, s.memoryUsedMb / s.memoryTotalMb));
};

const resourceScore = (s: Awaited<ReturnType<typeof listServers>>[number]): number => {
	const memoryLoad = memoryLoadScore(s);
	const cpuLoad = Math.min(1, Math.max(0, (s.cpuUsedPercent ?? 0) / 100));
	return memoryLoad * 0.7 + cpuLoad * 0.3;
};

export const pickBestServer = async (
	preferredServerId?: string | null,
	excludeServerId?: string | null,
	modeFilter?: string[],
): Promise<string> => {
	if (preferredServerId && preferredServerId !== excludeServerId) {
		const { getServerById } = await repo();
		const preferred = await getServerById(preferredServerId);
		if (preferred && (preferred.mode === "local" || isServerHealthy(preferred))) {
			if (!modeFilter || modeFilter.includes(preferred.mode)) return preferredServerId;
		}
	}
	const { ensureLocalServer, listProjects, listServers } = await repo();
	const servers = await listServers();
	const projects = await listProjects();
	const projectCount = new Map<string, number>();
	for (const p of projects) {
		if (!p.serverId) continue;
		projectCount.set(p.serverId, (projectCount.get(p.serverId) ?? 0) + 1);
	}
	const candidates = servers
		.filter(
			(s) =>
				(s.mode === "ssh" || s.mode === "agent") &&
				s.id !== excludeServerId &&
				isServerHealthy(s) &&
				(!modeFilter || modeFilter.includes(s.mode)),
		)
		.sort((a, b) => {
			const countDiff = (projectCount.get(a.id) ?? 0) - (projectCount.get(b.id) ?? 0);
			if (countDiff !== 0) return countDiff;
			const resourceDiff = resourceScore(a) - resourceScore(b);
			if (resourceDiff !== 0) return resourceDiff;
			return (a.cpuUsedPercent ?? 0) - (b.cpuUsedPercent ?? 0);
		});
	if (candidates.length > 0) return candidates[0].id;
	if (servers.some((s) => s.mode !== "local" && !isServerHealthy(s))) {
		console.warn("[Placement] No healthy remote server available; falling back to local");
	}
	await ensureLocalServer();
	return "local";
};

export const resolveDefaultServerId = pickBestServer;
