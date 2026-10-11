import type { ProjectCleanupInfo } from "../db/repo";
import type { Server } from "../types";

const CONTAINER_ID = /^[0-9a-f]{12,}$/;

export interface ProjectCleanupRunner {
	getServerById: (id: string) => Promise<Server | null>;
	ensureContainerRemoved: (name: string, server?: Server | null) => Promise<void>;
	ensureVolumeRemoved: (name: string, server?: Server | null) => Promise<void>;
	destroyComposeStack: (projectName: string, server?: Server | null) => Promise<void>;
	dockerRunTry: (cmd: string, args: string[], server?: Server | null) => Promise<string | undefined>;
}

export type ProjectCleanupTarget = Pick<
	ProjectCleanupInfo,
	"isCompose" | "projectServerId" | "deploymentTargets" | "databaseTargets" | "databaseVolumes" | "volumeDockerNames"
>;

export const cleanupProjectContainers = async (
	info: ProjectCleanupTarget,
	runner: ProjectCleanupRunner,
): Promise<string[]> => {
	const failures: string[] = [];
	const serverCache = new Map<string, Server | null>();
	const serverFor = async (serverId: string | null): Promise<Server | null> => {
		if (!serverId) return null;
		if (!serverCache.has(serverId)) {
			serverCache.set(serverId, await runner.getServerById(serverId).catch(() => null));
		}
		return serverCache.get(serverId) ?? null;
	};
	const requireServer = async (label: string, serverId: string | null): Promise<Server | null | undefined> => {
		if (!serverId) return null;
		const server = await serverFor(serverId);
		if (!server) {
			failures.push(`${label}: owning server ${serverId} could not be resolved`);
			return undefined;
		}
		return server;
	};
	const attempt = async (label: string, fn: () => Promise<unknown>) => {
		try {
			await fn();
		} catch (err) {
			failures.push(`${label}: ${(err as Error)?.message ?? err}`);
		}
	};

	for (const dep of info.deploymentTargets) {
		const label = `deployment ${dep.id}`;
		const server = await requireServer(label, dep.serverId);
		if (server === undefined) continue;
		if (info.isCompose) {
			await attempt(`${label} compose stack`, () =>
				runner.destroyComposeStack(dep.containerName || `deploy-${dep.id}`, server),
			);
		} else {
			if (dep.containerName) {
				await attempt(`${label} container ${dep.containerName}`, () =>
					runner.ensureContainerRemoved(dep.containerName as string, server),
				);
			}
			const replicas = await runner
				.dockerRunTry("docker", ["ps", "-aq", "--filter", `name=deploy-${dep.id}-replica-`], server)
				.catch(() => undefined);
			for (const cid of (replicas ?? "").split(/\s+/).filter((s) => CONTAINER_ID.test(s))) {
				await attempt(`${label} replica ${cid}`, () => runner.dockerRunTry("docker", ["rm", "-f", cid], server));
			}
		}
		if (dep.imageTag) {
			await attempt(`${label} image ${dep.imageTag}`, () =>
				runner.dockerRunTry("docker", ["rmi", "-f", dep.imageTag], server),
			);
		}
	}

	for (const dbTarget of info.databaseTargets) {
		const label = `database ${dbTarget.containerName ?? dbTarget.proxyContainerName ?? "container"}`;
		const server = await requireServer(label, dbTarget.serverId);
		if (server === undefined) continue;
		if (dbTarget.containerName) {
			await attempt(`${label} container`, () =>
				runner.ensureContainerRemoved(dbTarget.containerName as string, server),
			);
		}
		if (dbTarget.proxyContainerName) {
			await attempt(`${label} proxy`, () =>
				runner.ensureContainerRemoved(dbTarget.proxyContainerName as string, server),
			);
		}
	}

	for (const vol of info.databaseVolumes) {
		const label = `database volume ${vol.volumeName}`;
		const server = await requireServer(label, vol.serverId);
		if (server === undefined) continue;
		await attempt(label, () => runner.ensureVolumeRemoved(vol.volumeName, server));
	}

	if (info.volumeDockerNames.length > 0) {
		const server = await requireServer("project volume", info.projectServerId);
		if (server !== undefined) {
			for (const name of info.volumeDockerNames) {
				await attempt(`project volume ${name}`, () => runner.ensureVolumeRemoved(name, server));
			}
		}
	}

	return failures;
};
