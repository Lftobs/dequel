import type { Deployment, Project } from "../types";
import {
  appendLog,
  createAgentJob,
  listEnvironmentVariablesForDeploy,
  updateDeploymentStatus,
} from "../db/repo";
import type { RemoteGitDeployPayload } from "./protocol";
import { validateRemoteDeployment } from "./deployment-contract";

export { validateRemoteDeployment } from "./deployment-contract";

export const queueRemoteDeployment = async (deployment: Deployment, project: Project) => {
  const validationError = validateRemoteDeployment(deployment, project);
  if (validationError) throw new Error(validationError);
  if (!deployment.serverId || deployment.serverId === "local") throw new Error("Remote deployment requires an agent server");
  const environmentVariables = await listEnvironmentVariablesForDeploy(
    project.id,
    deployment.environment ?? "production",
  );
  const payload: RemoteGitDeployPayload = {
    deploymentId: deployment.id,
    projectId: project.id,
    projectName: project.name,
    gitUrl: deployment.sourceRef,
    branch: deployment.branch ?? undefined,
    commitSha: deployment.commitSha ?? undefined,
    appPort: project.port || 3000,
    cpuLimit: project.cpuLimit ?? undefined,
    memoryLimitMb: project.memoryLimitMb ?? undefined,
    environmentVariables,
  };
  await createAgentJob({
    deploymentId: deployment.id,
    serverId: deployment.serverId,
    type: "deploy",
    payload,
    idempotencyKey: `deployment:${deployment.id}`,
  });
  await updateDeploymentStatus(deployment.id, "pending", { failureReason: null });
  await appendLog(deployment.id, "system", `Deployment queued for server ${deployment.serverId}`);
};
