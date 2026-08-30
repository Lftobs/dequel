import { config } from "../utils/config";
import { removeRemoteCaddyRoute, runRemoteScript, syncRemoteCaddyRoute } from "../utils/ssh";
import { buildRemoteDeployScript, parseRemoteBuildResult } from "./ssh-build-script";
import { buildRemoteComposeScript, parseRemoteComposeResult, buildRemoteComposeDestroyScript } from "./ssh-compose-script";
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

const deployComposeRemote = async (
  deployment: Deployment,
  project: Project,
  server: Server,
) => {
  const { listEnvironmentVariablesForDeploy, listDeployments, updateDeploymentStatus } = await getRepo();
  await updateDeploymentStatus(deployment.id, "building", { failureReason: null });
  await emitLog(deployment.id, "system", `Deploying compose stack on server ${server.name} over SSH`);

  const envVars = await listEnvironmentVariablesForDeploy(project.id, deployment.environment ?? undefined);

  const script = buildRemoteComposeScript({
    deploymentId: deployment.id,
    workspaceRoot: config.workspaceRoot,
    gitUrl: deployment.sourceRef,
    branch: deployment.branch,
    commitSha: deployment.commitSha,
    projectName: project.name,
    dockerNetwork: config.dockerNetwork,
    environmentVariables: envVars,
    sourceDir: project.sourceDir,
  });

  const result = await runRemoteScript(server, script, {
    onLog: async (line) => { await emitLog(deployment.id, "build", line); },
  });
  if (result.code !== 0) throw new Error(result.stderr || result.stdout || "Remote compose build failed");

  const composeResult = parseRemoteComposeResult(result.stdout);
  if (!composeResult) throw new Error("Remote compose completed without a result marker");

  await updateDeploymentStatus(deployment.id, "deploying");
  await emitLog(deployment.id, "system", "Compose stack started — configuring routes");

  const all = await listDeployments(project.id);
  const current = all.find((d) => d.status === "running" && d.id !== deployment.id);

  const slug = slugify(project.name);
  const primaryServiceName = project.composeService || Object.keys(composeResult.containers)[0];
  const primaryContainer = composeResult.containers[primaryServiceName] || `deploy-${deployment.id}-${primaryServiceName}-1`;

  let customMappings: { serviceName: string; port: number | string; subdomain?: string }[] = [];
  if (project.composeServices) {
    try { customMappings = JSON.parse(project.composeServices); } catch {}
  }

  const webServices: { name: string; container: string; port: number }[] = [];
  for (const [svcName, svcContainer] of Object.entries(composeResult.containers)) {
    const mapping = customMappings.find((c) => c.serviceName === svcName);
    if (mapping) {
      webServices.push({ name: svcName, container: svcContainer, port: Number(mapping.port) || 3000 });
    } else if (svcName === primaryServiceName) {
      webServices.push({ name: svcName, container: svcContainer, port: project.composePort || 3000 });
    }
  }

  const { buildCaddySnippet } = await import("../utils/domain-verifier");
  const primary = webServices.find((s) => s.name === primaryServiceName) || webServices[0];
  let snippet = await buildCaddySnippet(slug, primary.container, project.id, undefined, primary.port);

  const rawBaseDomain = config.caddyBaseDomain || "localhost";
  const baseDomainForCaddy = rawBaseDomain === "localhost" ? `${rawBaseDomain}:80` : rawBaseDomain;
  for (const svc of webServices) {
    if (svc.name === primaryServiceName) continue;
    const customMatch = customMappings.find((c) => c.serviceName === svc.name);
    const domains: string[] = [];
    if (customMatch?.subdomain?.trim()) {
      domains.push(`${customMatch.subdomain.trim()}.${slug}.${baseDomainForCaddy}`);
    } else {
      domains.push(`${svc.name}.${slug}.${baseDomainForCaddy}`);
      if (svc.name === "server" && !domains.includes(`api.${slug}.${baseDomainForCaddy}`)) {
        domains.push(`api.${slug}.${baseDomainForCaddy}`);
      }
    }
    snippet += `\n${domains.join(", ")} {\n  log {\n    output stdout\n    format json\n  }\n  reverse_proxy ${svc.container}:${svc.port} {\n    header_up Host {upstream_hostport}\n  }\n}\n`;
  }

  const { shouldRouteViaIngress, syncIngressRoute, upsertIngressRoute } = await import("../utils/ingress");
  const { baseDomainFor } = await import("../utils/routes");
  const { getIngressServer } = await import("../utils/ingress");
  const { upsertRoute } = await import("../db/repo");

  const ingressServer = await getIngressServer();
  const viaIngress = shouldRouteViaIngress(server, ingressServer);

  const hostname = `${slug}.${baseDomainFor()}`;
  const primaryPort = primary.port;
  const allContainerNames = webServices.map((s) => s.container);

  let effectiveSnippet: string;
  if (viaIngress) {
    const targets = webServices.map((s) => `${s.container}:${s.port}`).join(" ");
    effectiveSnippet = `:80 {\n  reverse_proxy ${targets} {\n    header_up Host {upstream_hostport}\n  }\n}\n`;
  } else {
    effectiveSnippet = snippet;
  }

  if (server.mode === "ssh" || server.mode === "docker_tcp") {
    await syncRemoteCaddyRoute(server, `${slug}.caddy`, effectiveSnippet);
    await upsertRoute({
      serverId: server.id,
      deploymentId: deployment.id,
      projectId: project.id,
      hostname,
      routeFile: `${slug}.caddy`,
      port: primaryPort,
      targetContainers: allContainerNames,
      status: "active",
    });
  }

  const routeInfo = {
    hostname,
    routeFile: `${slug}.caddy`,
    port: primaryPort,
    containers: allContainerNames,
  };
  if (viaIngress && ingressServer) {
    await emitLog(deployment.id, "system", `Registering ingress route on ${ingressServer.name} for ${hostname}`);
    await syncIngressRoute(ingressServer, server.host, routeInfo);
    await upsertIngressRoute(ingressServer.id, project.id, deployment.id, server.host, routeInfo);
  }

  const scheme = rawBaseDomain === "localhost" ? "http" : "https";
  const liveUrl = `${scheme}://${hostname}`;

  await updateDeploymentStatus(deployment.id, "running", {
    containerName: composeResult.projectName,
    liveUrl,
  });
  await emitLog(deployment.id, "system", `Deployment is running at ${liveUrl}`);

  if (current) {
    await updateDeploymentStatus(current.id, "inactive", {
      failureReason: `Superseded by deployment ${deployment.id.slice(0, 8)}`,
    });
    await emitLog(current.id, "system", `Marked inactive (superseded by ${deployment.id.slice(0, 8)})`);
  }
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

    if (project.buildType === "compose") {
      await deployComposeRemote(deployment, project, server);
      return;
    }

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
    if (project?.buildType === "compose") {
      throw new Error("Rollback is not supported for Docker Compose deployments. Redeploy with the desired commit instead.");
    }
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

    if (project?.buildType === "compose" && deployment.containerName) {
      const script = buildRemoteComposeDestroyScript(deployment.containerName);
      await runRemoteScript(server, script, {
        onLog: async (line) => { await emitLog(deployment.id, "system", line); },
      });
    } else if (deployment.containerName) {
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
