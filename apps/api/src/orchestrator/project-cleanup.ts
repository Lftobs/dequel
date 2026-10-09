import type { ProjectCleanupInfo } from "../db/repo";
import type { Server } from "../types";

const CONTAINER_ID = /^[0-9a-f]{12,}$/;

export interface ProjectCleanupRunner {
	getServerById: (id: string) => Promise<Server | null>;
	ensureContainerRemoved: (name: string, server?: Server | null) => Promise<void>;
	destroyComposeStack: (projectName: string, server?: Server | null) => Promise<void>;
	dockerRunTry: (cmd: string, args: string[], server?: Server | null) => Promise<string | undefined>;
}

export type ProjectCleanupTarget = Pick<ProjectCleanupInfo, "deploymentTargets" | "databaseTargets">;

export const cleanupProjectContainers = async (
	info: ProjectCleanupTarget,
	runner: ProjectCleanupRunner,
): Promise<void> => {
	const serverCache = new Map<string, Server | null>();
	const serverFor = async (serverId: string | null): Promise<Server | null> => {
		if (!serverId) return null;
		if (!serverCache.has(serverId)) {
			serverCache.set(serverId, await runner.getServerById(serverId).catch(() => null));
		}
		return serverCache.get(serverId) ?? null;
	};

	for (const dep of info.deploymentTargets) {
		const server = await serverFor(dep.serverId);
		if (dep.sourceType === "compose") {
			await runner.destroyComposeStack(dep.containerName || `deploy-${dep.id}`, server).catch(() => {});
		} else {
			if (dep.containerName) await runner.ensureContainerRemoved(dep.containerName, server).catch(() => {});
			const replicas = await runner
				.dockerRunTry("docker", ["ps", "-aq", "--filter", `name=deploy-${dep.id}-replica-`], server)
				.catch(() => undefined);
			for (const cid of (replicas ?? "").split(/\s+/).filter((s) => CONTAINER_ID.test(s))) {
				await runner.dockerRunTry("docker", ["rm", "-f", cid], server).catch(() => {});
			}
		}
		if (dep.imageTag) await runner.dockerRunTry("docker", ["rmi", "-f", dep.imageTag], server).catch(() => {});
	}

	for (const dbTarget of info.databaseTargets) {
		const server = await serverFor(dbTarget.serverId);
		if (dbTarget.containerName) await runner.ensureContainerRemoved(dbTarget.containerName, server).catch(() => {});
		if (dbTarget.proxyContainerName) {
			await runner.ensureContainerRemoved(dbTarget.proxyContainerName, server).catch(() => {});
		}
	}
};
