import type { Deployment, Project } from "../types";
import {
  appendLog,
  createAgentJob,
  listEnvironmentVariablesForDeploy,
  updateDeploymentStatus,
  upsertRoute,
} from "../db/repo";
import type { RemoteGitDeployPayload } from "./protocol";
import { validateRemoteDeployment } from "./deployment-contract";
import { routeNamesFor } from "../utils/routes";

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
  const { slug, hostname, routeFile } = routeNamesFor(project.name, project.id, deployment.id);
  const containerName = `${slug}-${deployment.id.slice(0, 8)}`;
  const appPort = project.port || 3000;
  await upsertRoute({
    serverId: deployment.serverId,
    deploymentId: deployment.id,
    projectId: project.id,
    hostname,
    routeFile,
    port: appPort,
    targetContainers: [containerName],
    status: "pending",
  });
  await createAgentJob({
    deploymentId: deployment.id,
    serverId: deployment.serverId,
    type: "reload_routes",
    payload: {
      deploymentId: deployment.id,
      action: "add",
      hostname,
      routeFile,
      port: appPort,
      targetContainers: [containerName],
    },
    idempotencyKey: `route:add:${slug}:${deployment.id}`,
  });
  await updateDeploymentStatus(deployment.id, "pending", { failureReason: null });
  await appendLog(deployment.id, "system", `Deployment queued for server ${deployment.serverId}`);
};
