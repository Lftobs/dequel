import type { Deployment, Project, Server } from "../types";
import type { DeploymentExecutor, ExecutorCancelInput, ExecutorDeployInput, ExecutorDestroyInput, ExecutorRollbackInput } from "./types";
import { routeNamesFor } from "../utils/routes";

let repoModule: typeof import("../db/repo") | null = null;
let deploymentsModule: typeof import("../agents/deployments") | null = null;

const getRepo = async () => (repoModule ??= await import("../db/repo"));
const getDeployments = async () => (deploymentsModule ??= await import("../agents/deployments"));

export const queueRemoteRollback = async (deployment: Deployment, project: Project | null, server: Server) => {
  if (!deployment.imageTag) throw new Error("Deployment has no built image to rollback to");
  if (!deployment.serverId || deployment.serverId === "local") throw new Error("Remote rollback requires an agent server");
  if (project?.buildType === "compose") throw new Error("Rollback is not supported for Docker Compose deployments");

  const { createAgentJob, listEnvironmentVariablesForDeploy, listVolumes, updateDeploymentStatus, appendLog } = await getRepo();
  const environmentVariables = await listEnvironmentVariablesForDeploy(deployment.projectId ?? "", deployment.environment ?? undefined);
  const volumes = await listVolumes(deployment.projectId ?? "");

  const payload = {
    deploymentId: deployment.id,
    projectId: deployment.projectId ?? null,
    projectName: project?.name ?? null,
    imageTag: deployment.imageTag,
    appPort: project?.port || 3000,
    cpuLimit: project?.cpuLimit ?? null,
    memoryLimitMb: project?.memoryLimitMb ?? null,
    environmentVariables,
    volumes: volumes.map((v) => ({
      volumeName: v.dockerVolumeName ?? `vol-${v.id.slice(0, 12)}`,
      mountPath: v.mountPath,
    })),
  };

  await createAgentJob({
    deploymentId: deployment.id,
    serverId: deployment.serverId,
    type: "rollback",
    payload,
    idempotencyKey: `rollback:${deployment.id}`,
  });
  await updateDeploymentStatus(deployment.id, "pending", { failureReason: null });
  await appendLog(deployment.id, "system", `Rollback queued for server ${server.name}`);
};

export const queueRemoteDestroy = async (deployment: Deployment, server: Server, project: Project | null = null) => {
  if (!deployment.serverId || deployment.serverId === "local") throw new Error("Remote destroy requires an agent server");
  const { createAgentJob, appendLog } = await getRepo();
  await createAgentJob({
    deploymentId: deployment.id,
    serverId: deployment.serverId,
    type: "destroy",
    payload: {
      deploymentId: deployment.id,
      containerName: deployment.containerName ?? null,
      imageTag: deployment.imageTag ?? null,
    },
    idempotencyKey: `destroy:${deployment.id}`,
  });
  const { slug, hostname, routeFile } = routeNamesFor(project?.name ?? null, deployment.projectId, deployment.id);
  const appPort = project?.port || 3000;
  await createAgentJob({
    deploymentId: deployment.id,
    serverId: deployment.serverId,
    type: "reload_routes",
    payload: {
      deploymentId: deployment.id,
      action: "remove",
      hostname,
      routeFile,
      port: appPort,
      targetContainers: [],
    },
    idempotencyKey: `route:remove:${slug}:${deployment.id}`,
  });
  await appendLog(deployment.id, "system", `Destroy queued for server ${server.name}`);
};

export const agentExecutor: DeploymentExecutor = {
  mode: "agent",

  async deploy({ deployment, project, server }: ExecutorDeployInput) {
    if (!project) throw new Error("Remote deployment requires a project");
    const { queueRemoteDeployment } = await getDeployments();
    await queueRemoteDeployment(deployment, project);
  },

  async rollback({ deployment, project, server }: ExecutorRollbackInput) {
    await queueRemoteRollback(deployment, project, server);
  },

  async destroy({ deployment, server, project }: ExecutorDestroyInput) {
    await queueRemoteDestroy(deployment, server, project ?? null);
  },

  async cancel({ deployment }: ExecutorCancelInput) {
    const { cancelAgentJobsByDeploymentId, updateDeploymentStatus, appendLog } = await getRepo();
    if (deployment.status !== "pending" && deployment.status !== "building") return;
    await cancelAgentJobsByDeploymentId(deployment.id);
    await updateDeploymentStatus(deployment.id, "failed", { failureReason: "Cancelled" });
    await appendLog(deployment.id, "system", "Deployment cancelled by user");
  },
};
