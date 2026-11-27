import { listDeployments, updateDeploymentStatus } from "../db/repo";
import type { Server } from "../types";
import { dockerBin } from "../utils/docker-bin";
import { tryRun } from "./runtime";

type SupersedeOptions = {
	projectId: string;
	currentDeploymentId: string;
	keepContainerName: string;
	compose: boolean;
	targetServer: Server | null;
	onLog: (deploymentId: string, message: string) => Promise<void>;
};

const removeReplicas = async (deploymentId: string, targetServer: Server | null) => {
	const listed = await tryRun(
		dockerBin,
		["ps", "-a", "--format", "{{.Names}}", "--filter", `name=deploy-${deploymentId}-replica-`],
		targetServer,
	);
	const names = (listed ?? "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	for (const name of names) {
		await tryRun(dockerBin, ["stop", "-t", "10", name], targetServer);
		await tryRun(dockerBin, ["rm", "-f", name], targetServer);
	}
	return names.length;
};

export const supersedeRunningDeployments = async (opts: SupersedeOptions): Promise<number> => {
	const siblings = await listDeployments(opts.projectId);
	const stale = siblings.filter((d) => d.id !== opts.currentDeploymentId && d.status === "running");

	for (const sibling of stale) {
		await updateDeploymentStatus(sibling.id, "inactive", { failureReason: "Superseded by new deployment" });
		await opts.onLog(sibling.id, `Deployment marked inactive (superseded by ${opts.currentDeploymentId})`);

		if (opts.compose) continue;
		if (!sibling.containerName || sibling.containerName === opts.keepContainerName) continue;

		await tryRun(dockerBin, ["stop", "-t", "10", sibling.containerName], opts.targetServer);
		const removed = await tryRun(dockerBin, ["rm", "-f", sibling.containerName], opts.targetServer);
		if (removed !== undefined) {
			await opts.onLog(sibling.id, `Removed superseded container ${sibling.containerName}`);
		}
		await removeReplicas(sibling.id, opts.targetServer);
	}

	return stale.length;
};
