import {
  acknowledgeAgentJob,
  appendLog,
  deleteDeploymentAndLogs,
  finishAgentJob,
  getAgentJobDeploymentId,
  getAgentJobInfo,
  leaseNextAgentJob,
  listCancelledJobIds,
  listDeployments,
  updateAgentHeartbeat,
  updateDeploymentCommitSha,
  updateDeploymentStatus,
  deleteRoutesByDeployment,
  updateRouteStatus,
} from "../db/repo";
import { agentStatsCache } from "./stats-cache";
import { isRemoteDeployResult, type AgentCapabilities, type AgentContainerStat, type P2PAgentRequest } from "./protocol";

export const HEARTBEAT_INTERVAL_MS = 15_000;

export const handleP2PHeartbeat = async (
  serverId: string,
  patch: {
    agentVersion: string;
    capabilities: AgentCapabilities;
    cpuUsedPercent?: number;
    memoryUsedMb?: number;
    containers?: AgentContainerStat[];
  },
) => {
  await updateAgentHeartbeat(serverId, {
    agentVersion: patch.agentVersion,
    capabilities: patch.capabilities,
    cpuUsedPercent: patch.cpuUsedPercent,
    memoryUsedMb: patch.memoryUsedMb,
  });
  if (patch.containers && patch.containers.length > 0) {
    await agentStatsCache.set(serverId, patch.containers);
  }
};

export const processAgentJobUpdate = async (serverId: string, update: Exclude<P2PAgentRequest, { type: "p2p_heartbeat" }>): Promise<void> => {
  if (update.type === "job_ack") {
    if (!(await acknowledgeAgentJob(update.jobId, serverId, update.leaseId))) return;
    const deploymentId = await getAgentJobDeploymentId(update.jobId, serverId, update.leaseId);
    if (deploymentId) await updateDeploymentStatus(deploymentId, "building", { failureReason: null });
    return;
  }
  if (update.type === "job_progress") {
    const deploymentId = await getAgentJobDeploymentId(update.jobId, serverId, update.leaseId);
    if (deploymentId) {
      const stage = update.stage === "deploy" ? "deploy" : update.stage === "build" ? "build" : "system";
      if (stage === "deploy") await updateDeploymentStatus(deploymentId, "deploying");
      await appendLog(deploymentId, stage, update.message).catch(() => {});
    }
    return;
  }
  const jobInfo = await getAgentJobInfo(update.jobId, serverId, update.leaseId);
  const deploymentId = jobInfo?.deploymentId ?? null;

  if (jobInfo?.type === "destroy") {
    if (update.success && deploymentId) {
      await deleteDeploymentAndLogs(deploymentId);
      await deleteRoutesByDeployment(deploymentId);
    }
    await finishAgentJob(update.jobId, serverId, update.leaseId, update.success, update.error);
    return;
  }

  if (jobInfo?.type === "reload_routes") {
    const payload = (jobInfo.payload ?? {}) as { hostname?: string };
    if (update.success && payload.hostname) {
      await updateRouteStatus(payload.hostname, "active", null, serverId);
    } else if (!update.success && payload.hostname) {
      await updateRouteStatus(payload.hostname, "failed", update.error || "Route reload failed", serverId);
    }
    await finishAgentJob(update.jobId, serverId, update.leaseId, update.success, update.error);
    return;
  }

  if (update.success && !isRemoteDeployResult(update.result)) return;
  if (deploymentId) {
    if (update.success && isRemoteDeployResult(update.result)) {
      if (update.result.commitSha) await updateDeploymentCommitSha(deploymentId, update.result.commitSha);
      await updateDeploymentStatus(deploymentId, "running", {
        imageTag: update.result.imageTag,
        containerName: update.result.containerName,
        liveUrl: update.result.liveUrl,
        failureReason: null,
      });
      await appendLog(deploymentId, "system", `Remote deployment is running on server ${serverId}`);
      if (jobInfo?.type === "rollback") {
        const payload = (jobInfo.payload ?? {}) as { projectId?: string | null };
        if (payload.projectId) {
          const all = await listDeployments(payload.projectId);
          const current = all.find((d) => d.status === "running" && d.id !== deploymentId);
          if (current) {
            await updateDeploymentStatus(current.id, "inactive", { failureReason: `Superseded by rollback to ${deploymentId.slice(0, 8)}` });
            await appendLog(current.id, "system", `Marked inactive (rolled back to ${deploymentId.slice(0, 8)})`);
          }
        }
      }
    } else {
      await updateDeploymentStatus(deploymentId, "failed", { failureReason: update.error || "Remote agent deployment failed" });
      await appendLog(deploymentId, "system", `Remote deployment failed: ${update.error || "Unknown agent error"}`);
    }
  }
  await finishAgentJob(update.jobId, serverId, update.leaseId, update.success, update.error);
};

export const nextJobBatch = async (serverId: string) => {
  const job = await leaseNextAgentJob(serverId);
  return { jobs: job ? [job] : [], cancelJobIds: await listCancelledJobIds(serverId) };
};