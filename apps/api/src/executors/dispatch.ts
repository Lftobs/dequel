import { agentExecutor } from "./agent";
import { localExecutor } from "./local";
import { sshExecutor } from "./ssh";
import type { DeploymentExecutor } from "./types";

export const executorFor = (mode: string): DeploymentExecutor => {
  switch (mode) {
    case "agent":
      return agentExecutor;
    case "ssh":
      return sshExecutor;
    default:
      return localExecutor;
  }
};

export { agentExecutor, localExecutor, sshExecutor };
export type { DeploymentExecutor, ExecutorDeployInput, ExecutorRollbackInput, ExecutorDestroyInput, ExecutorCancelInput } from "./types";