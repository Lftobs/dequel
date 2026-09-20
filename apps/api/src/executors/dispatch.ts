import { agentExecutor } from "./agent";
import { localExecutor } from "./local";
import { sshExecutor } from "./ssh";
import type { DeploymentExecutor } from "./types";

export const executorFor = (mode: string): DeploymentExecutor => {
	switch (mode) {
		case "local":
			return localExecutor;
		case "agent":
			return agentExecutor;
		case "ssh":
			return sshExecutor;
		case "docker_tcp":
			return localExecutor;
		default:
			throw new Error(`Unsupported server mode: ${mode}`);
	}
};

export type {
	DeploymentExecutor,
	ExecutorCancelInput,
	ExecutorDeployInput,
	ExecutorDestroyInput,
	ExecutorRollbackInput,
} from "./types";
export { agentExecutor, localExecutor, sshExecutor };
