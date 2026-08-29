import { config } from "../utils/config";
import { removeRemoteCaddyRoute, runRemoteScript } from "../utils/ssh";
import { buildRemoteDeployScript, parseRemoteBuildResult } from "./ssh-build-script";
import { emitLog } from "./logging";
import { summarizeDeploymentError } from "../orchestrator/deployment-errors";
import type { Deployment, Project, Server } from "../types";
import type { DeploymentExecutor, ExecutorCancelInput, ExecutorDeployInput, ExecutorRollbackInput } from "./types";

let repoModule: typeof import("../db/repo") | null = null;
let runtimeModule: typeof import("../orchestrator/runtime") | null = null;

const getRepo = async () => (repoModule ??= await import("../db/repo"));
const getRuntime = async () => (runtimeModule ??= await import("../orchestrator/runtime"));

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);

const buildEnvVars = async (deployment: Deployment) => {
  const { listEnvironmentVariablesForDeploy } = await getRepo();
  const vars = await listEnvironmentVariablesForDeploy(deployment.projectId ?? "", deployment.environment ?? undefined);
  if (vars.length === 0) return undefined;
  const envVars: Record<string, string> = {};
  for (const v of vars) envVars[v.key] = v.value;
  return envVars;
};

const buildVolumes = async (deployment: Deployment) => {
  const { listVolumes } = await getRepo();
  const vols = await listVolumes(deployment.projectId ?? "");
  if (vols.length === 0) return undefined;
  return vols.map((v) => ({
    volumeName: v.dockerVolumeName ?? `vol-${v.id.slice(0, 12)}`,
    mountPath: v.mountPath,
  }));
};

const deployFromImage = async (
  deployment: Deployment,
  project: Project | null,
  server: Server,
  imageTag: string,
  oldContainerName?: string,
) => {
  const { updateDeploymentStatus } = await getRepo();
  const { deployContainer } = await getRuntime();
  const envVars = await buildEnvVars(deployment);
  const volumes = await buildVolumes(deployment);
  const runtime = await deployContainer(
    deployment.id,
    imageTag,
    async (line) => { await emitLog(deployment.id, "deploy", line); },
    {
      projectId: deployment.projectId ?? undefined,
      projectName: project?.name,
      baseDomain: project?.baseDomain,
      oldContainerName,
      envVars,
      volumes,
      cpuLimit: project?.cpuLimit,
      memoryLimitMb: project?.memoryLimitMb,
      appPort: project?.port,
      targetServer: server,
    },
  );
  await updateDeploymentStatus(deployment.id, "running", {
    containerName: runtime.containerName,
    liveUrl: runtime.liveUrl,
    imageTag,
  });
  await emitLog(deployment.id, "system", "Deployment is running");
  return runtime;
};

const markFailed = async (deploymentId: string, error: unknown) => {
  const { updateDeploymentStatus } = await getRepo();
  const message = summarizeDeploymentError(error);
  await emitLog(deploymentId, "system", `Deployment failed: ${message}`);
  await updateDeploymentStatus(deploymentId, "failed", { failureReason: message });
};

export const sshExecutor: DeploymentExecutor = {
  mode: "ssh",

  async deploy({ deployment, project, server }: ExecutorDeployInput) {
    if (deployment.sourceType !== "git") throw new Error("SSH mode currently supports Git deployments only");
    if (!project) throw new Error("Deployment requires a project");

    const { listEnvironmentVariablesForDeploy, listDeployments, updateDeploymentStatus } = await getRepo();
    await updateDeploymentStatus(deployment.id, "building", { failureReason: null });
    await emitLog(deployment.id, "system", `Deploying on server ${server.name} over SSH (build runs on the target machine)`);

    const imageTag = `${slugify(project.name)}-${deployment.id.slice(0, 8)}:latest`;
    const envVars = await listEnvironmentVariablesForDeploy(project.id, deployment.environment ?? undefined);
    const script = buildRemoteDeployScript({
      deploymentId: deployment.id,
      workspaceRoot: config.workspaceRoot,
      gitUrl: deployment.sourceRef,
      branch: deployment.branch,
      commitSha: deployment.commitSha,
      imageTag,
      clearCache: deployment.clearCache ?? false,
      environmentVariables: envVars,
    });

    try {
      const result = await runRemoteScript(server, script, {
        onLog: async (line) => { await emitLog(deployment.id, "build", line); },
      });
      if (result.code !== 0) throw new Error(result.stderr || result.stdout || "Remote build failed");

      const buildResult = parseRemoteBuildResult(result.stdout);
      if (!buildResult) throw new Error("Remote build completed without a result marker");

      await updateDeploymentStatus(deployment.id, "deploying");
      await emitLog(deployment.id, "system", "Build complete — starting container on server");

      const all = await listDeployments(project.id);
      const current = all.find((d) => d.status === "running" && d.id !== deployment.id);

      await deployFromImage(deployment, project, server, buildResult.imageTag, current?.containerName ?? undefined);

      if (current) {
        await updateDeploymentStatus(current.id, "inactive", { failureReason: `Superseded by deployment ${deployment.id.slice(0, 8)}` });
        await emitLog(current.id, "system", `Marked inactive (superseded by ${deployment.id.slice(0, 8)})`);
      }
    } catch (error) {
      await markFailed(deployment.id, error);
    }
  },

  async rollback({ deployment, project, server, imageTag }: ExecutorRollbackInput) {
    const { getProjectById, listDeployments, updateDeploymentStatus } = await getRepo();
    await updateDeploymentStatus(deployment.id, "deploying");
    await emitLog(deployment.id, "system", `Rolling back to this version (image: ${imageTag})`);
    try {
      const all = await listDeployments(deployment.projectId ?? "");
      const current = all.find((d) => d.status === "running" && d.id !== deployment.id);
      const resolvedProject = project ?? (deployment.projectId ? await getProjectById(deployment.projectId) : null);
      const runtime = await deployFromImage(deployment, resolvedProject, server, imageTag, current?.containerName ?? undefined);
      if (current) {
        await updateDeploymentStatus(current.id, "inactive", { failureReason: `Superseded by rollback to ${deployment.id.slice(0, 8)}` });
        await emitLog(current.id, "system", `Marked inactive (rolled back to ${deployment.id.slice(0, 8)})`);
      }
      return runtime;
    } catch (error) {
      const message = summarizeDeploymentError(error);
      await emitLog(deployment.id, "system", `Rollback failed: ${message}`);
      await updateDeploymentStatus(deployment.id, "failed", { failureReason: message });
      throw error;
    }
  },

  async destroy({ deployment, project, server }) {
    const { deleteDeploymentAndLogs, deleteRoutesByDeployment } = await getRepo();
    const { tryRun } = await getRuntime();
    if (deployment.containerName) {
      await tryRun("docker", ["stop", "-t", "5", deployment.containerName], server);
      await tryRun("docker", ["rm", "-f", deployment.containerName], server);
    }
    if (deployment.imageTag && deployment.sourceType !== "image") {
      await tryRun("docker", ["rmi", "-f", deployment.imageTag], server);
    }
    const slug = slugify(project?.name || deployment.projectId || deployment.id);
    await removeRemoteCaddyRoute(server, `${slug}.caddy`);
    const { getIngressServer, removeIngressRouteFile } = await import("../utils/ingress");
    const ingressServer = await getIngressServer();
    if (ingressServer && ingressServer.id !== server.id) {
      const { baseDomainFor } = await import("../utils/routes");
      await removeIngressRouteFile(ingressServer, { hostname: `${slug}.${baseDomainFor()}`, routeFile: `${slug}.caddy` });
    }
    await deleteRoutesByDeployment(deployment.id);
    await deleteDeploymentAndLogs(deployment.id);
  },

  async cancel({ deployment }: ExecutorCancelInput) {
    const { updateDeploymentStatus } = await getRepo();
    if (deployment.status !== "pending" && deployment.status !== "building") return;
    await updateDeploymentStatus(deployment.id, "failed", { failureReason: "Cancelled" });
    await emitLog(deployment.id, "system", "Deployment cancelled by user (remote build may continue on the server)");
  },
};
