import type { DeploymentExecutor, ExecutorCancelInput, ExecutorDeployInput, ExecutorDestroyInput, ExecutorRollbackInput } from "./types";

let orchestratorModule: typeof import("../orchestrator") | null = null;

const getOrchestrator = async () => (orchestratorModule ??= await import("../orchestrator"));

export const localExecutor: DeploymentExecutor = {
  mode: "local",

  async deploy({ deployment }: ExecutorDeployInput) {
    const { orchestrator } = await getOrchestrator();
    orchestrator.enqueue(deployment.id);
  },

  async rollback({ deployment }: ExecutorRollbackInput) {
    const { orchestrator } = await getOrchestrator();
    await orchestrator.rollbackTo(deployment.id);
  },

  async destroy({ deployment }: ExecutorDestroyInput) {
    const { orchestrator } = await getOrchestrator();
    await orchestrator.deleteDeployment(deployment.id);
  },

  async cancel({ deployment }: ExecutorCancelInput) {
    const { orchestrator } = await getOrchestrator();
    await orchestrator.cancelDeployment(deployment.id);
  },
};