import { getServerById } from "../db/repo";
import type { Server } from "../types";
import { dockerRun, getDockerTargetArgs } from "../utils/docker-run";

export interface RuntimeLogLine {
	sequence: number;
	message: string;
	timestamp: string;
	stage: "runtime";
}

interface DeploymentTarget {
	id: string;
	containerName?: string | null;
	serverId?: string | null;
}

const resolveServer = async (deployment: DeploymentTarget): Promise<Server | null> =>
	deployment.serverId ? await getServerById(deployment.serverId) : null;

const containerNameFor = (deployment: DeploymentTarget): string =>
	deployment.containerName || `deploy-${deployment.id}`;

export const readRuntimeLogs = async (deployment: DeploymentTarget): Promise<RuntimeLogLine[]> => {
	const server = await resolveServer(deployment);
	const output = await dockerRun("docker", ["logs", "--tail", "200", containerNameFor(deployment)], server);
	return output
		.split("\n")
		.filter(Boolean)
		.map((line, i) => ({
			sequence: i + 1,
			message: line,
			timestamp: new Date().toISOString(),
			stage: "runtime" as const,
		}));
};

export const runtimeLogFollowerArgs = async (deployment: DeploymentTarget): Promise<string[]> => {
	const server = await resolveServer(deployment);
	return [...getDockerTargetArgs(server), "logs", "--tail", "100", "--follow", containerNameFor(deployment)];
};
