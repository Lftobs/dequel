import http from "node:http";
import {
  appendLog,
  createDeployment,
  getProjectById,
  getServerById,
  listDeployments,
  listProjects,
  listRoutes,
  updateDeploymentStatus,
  updateProject,
  updateRouteStatus,
} from "../db/repo";
import { getIngressServer, removeIngressRouteFile } from "../utils/ingress";
import { pickBestServer } from "../utils/server-default";

const CHECK_INTERVAL_MS = 30_000;
const GRACE_MS = 180_000;
const CONNECT_TIMEOUT_MS = 5_000;

const unreachableSince = new Map<string, number>();
const failingOver = new Set<string>();
const previouslyUnreachableServers = new Set<string>();

export const isServerReachable = (host: string, port: number = 80): Promise<boolean> =>
  new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/`, { timeout: CONNECT_TIMEOUT_MS }, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });

export const failoverProject = async (projectId: string) => {
  if (failingOver.has(projectId)) throw new Error("Failover already in progress for this project");
  const project = await getProjectById(projectId);
  if (!project) throw new Error("Project not found");
  if (!project.serverId) throw new Error("Project has no server assigned");
  const ingressServer = await getIngressServer();
  if (!ingressServer) throw new Error("No ingress server configured");
  const currentServer = await getServerById(project.serverId);
  if (!currentServer || currentServer.mode !== "ssh") throw new Error("Failover only supports SSH project servers");

  const deployments = await listDeployments(projectId, 0, 1);
  const latest = deployments[0];
  if (!latest) throw new Error("Project has no deployments to fail over");
  if (latest.sourceType !== "git") throw new Error("Failover requires a Git deployment");

  failingOver.add(projectId);
  try {
    const targetId = await pickBestServer(null, project.serverId, ["ssh"]);
    if (!targetId || targetId === project.serverId || targetId === 'local') {
      throw new Error("No other healthy server available for failover");
    }
    const targetServer = await getServerById(targetId);
    if (!targetServer) throw new Error("Target server not found");

    const deployment = await createDeployment({
      projectId,
      serverId: targetId,
      sourceType: "git",
      sourceRef: latest.sourceRef,
      branch: latest.branch ?? undefined,
      commitSha: latest.commitSha ?? undefined,
      environment: latest.environment ?? undefined,
      clearCache: false,
    });
    await appendLog(deployment.id, "system", `Failover: redeploying to server ${targetServer.name}`);

    if (targetServer.mode === "ssh") {
      const { executorFor } = await import("../executors/dispatch");
      void executorFor("ssh").deploy({ deployment, project, server: targetServer }).catch((error) => {
        console.error(`[Failover] Deployment ${deployment.id} failed:`, error);
      });
    } else {
      const { queueRemoteDeployment } = await import("../agents/deployments");
      await queueRemoteDeployment(deployment, project);
    }

    await updateProject(projectId, { serverId: targetId });
    await updateDeploymentStatus(latest.id, "inactive", {
      failureReason: `Superseded by failover deployment to ${targetServer.name}`,
    }).catch(() => {});
    return deployment;
  } finally {
    failingOver.delete(projectId);
  }
};

export const cleanupStaleRoutes = async (ingressServer: { id: string; mode: string }, serverId: string) => {
  const routes = await listRoutes(serverId);
  console.log(`[Failover] cleanupStaleRoutes: server=${serverId}, routes=${routes.length}`);
  if (!routes.length) return;
  for (const route of routes) {
    if (!route.projectId) continue;
    const project = await getProjectById(route.projectId);
    console.log(`[Failover] route ${route.hostname}: project=${route.projectId}, project.serverId=${project?.serverId}, serverId=${serverId}, match=${project?.serverId === serverId}`);
    if (!project || project.serverId !== serverId) {
      console.log(`[Failover] Cleaning stale route ${route.hostname} for project ${route.projectId} (no longer on server ${serverId})`);
      await removeIngressRouteFile(ingressServer, { hostname: route.hostname, routeFile: route.routeFile }).catch(() => {});
      await updateRouteStatus(route.hostname, "removed", null, serverId).catch(() => {});
    }
  }
};

export const failoverMonitorTick = async () => {
  try {
    const ingressServer = await getIngressServer();
    if (!ingressServer) {
      unreachableSince.clear();
      previouslyUnreachableServers.clear();
      return;
    }
    const projects = await listProjects();
    const currentUnreachableServers = new Set<string>();
    const checks = projects
      .filter((p) => p.serverId && p.serverId !== "local" && p.serverId !== ingressServer.id)
      .map(async (project) => {
        const server = await getServerById(project.serverId!);
        if (!server || server.mode !== "ssh") return;
        const reachable = await isServerReachable(server.host, 80);
        if (reachable) {
          unreachableSince.delete(project.id);
          return;
        }
        currentUnreachableServers.add(project.serverId!);
        const firstSeen = unreachableSince.get(project.id) ?? Date.now();
        unreachableSince.set(project.id, firstSeen);
        if (Date.now() - firstSeen < GRACE_MS || failingOver.has(project.id)) return;
        console.log(`[Failover] Server ${server.name} unreachable for ${Math.round((Date.now() - firstSeen) / 1000)}s — failing over project ${project.name}`);
        failoverProject(project.id).catch((error) => {
          console.error(`[Failover] Auto-failover for project ${project.id} failed:`, error);
          unreachableSince.delete(project.id);
        });
      });
    await Promise.all(checks);

    const recoveredServers = [...previouslyUnreachableServers].filter((id) => !currentUnreachableServers.has(id));
    for (const serverId of recoveredServers) {
      console.log(`[Failover] Server ${serverId} recovered — cleaning up stale routes`);
      await cleanupStaleRoutes(ingressServer, serverId).catch((error) => {
        console.error(`[Failover] Stale route cleanup for server ${serverId} failed:`, error);
      });
    }
    previouslyUnreachableServers.clear();
    for (const id of currentUnreachableServers) previouslyUnreachableServers.add(id);
  } catch (error) {
    console.error("[Failover] Monitor tick failed:", error);
  }
};

export const startFailoverMonitor = () => {
  const handle = setInterval(failoverMonitorTick, CHECK_INTERVAL_MS);
  failoverMonitorTick();
  return handle;
};

export const failoverState = () => ({
  unreachable: [...unreachableSince.entries()].map(([projectId, since]) => ({
    projectId,
    unreachableForMs: Date.now() - since,
  })),
});