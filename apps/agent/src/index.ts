import { config, requireControlPlaneUrl } from "./config";
import { collectCapabilities, collectResourceUsage } from "./capabilities";
import { loadCredential, registerAgent } from "./credentials";
import { collectContainerStats } from "./stats";
import { bringUpTunnel } from "./wireguard";
import { AGENT_PROTOCOL_VERSION, parseP2PResponse, serializeAgentMessage, type AgentJobEnvelope, type AgentMessage } from "./protocol";
import { executeJob } from "./executor";

const capabilities = await collectCapabilities();
const stored = await loadCredential() ?? await registerAgent(capabilities);

if (stored.wireguard) {
  const tunnelUp = await bringUpTunnel(stored.wireguard);
  if (tunnelUp && config.tunnelUrl) console.log(`[Agent] Polling control plane over WireGuard tunnel at ${config.tunnelUrl}`);
}

const endpoint = (config.tunnelUrl || requireControlPlaneUrl()).replace(/\/+$/, "") + "/api/agents/p2p-sync";

let retryMs = 1_000;
const activeJobs = new Map<string, AbortController>();
let busy = false;

const sync = async (message: AgentMessage): Promise<void> => {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: serializeAgentMessage(message),
  });
  if (!res.ok) throw new Error(`p2p-sync failed (${res.status})`);
  const parsed = parseP2PResponse(await res.json());
  if (!parsed) throw new Error("Invalid p2p-sync response");
  for (const jobId of parsed.cancelJobIds) {
    const controller = activeJobs.get(jobId);
    if (controller) controller.abort();
  }
  if (parsed.jobs.length > 0 && !busy) {
    busy = true;
    try {
      await runJob(parsed.jobs[0]);
    } finally {
      busy = false;
    }
  }
};

const runJob = async (job: AgentJobEnvelope) => {
  const controller = new AbortController();
  activeJobs.set(job.id, controller);
  try {
    await sync({ type: "job_ack", protocolVersion: AGENT_PROTOCOL_VERSION, credential: stored.credential, jobId: job.id, leaseId: job.leaseId });
    const result = await executeJob(job, controller.signal, async (stage, message) => {
      await sync({ type: "job_progress", protocolVersion: AGENT_PROTOCOL_VERSION, credential: stored.credential, jobId: job.id, leaseId: job.leaseId, stage, message }).catch(() => {});
    });
    await sync({ type: "job_result", protocolVersion: AGENT_PROTOCOL_VERSION, credential: stored.credential, jobId: job.id, leaseId: job.leaseId, success: true, result });
  } catch (error) {
    await sync({
      type: "job_result",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      credential: stored.credential,
      jobId: job.id,
      leaseId: job.leaseId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => {});
  } finally {
    activeJobs.delete(job.id);
  }
};

const poll = async () => {
  try {
    const containers = await collectContainerStats();
    await sync({
      type: "p2p_heartbeat",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      credential: stored.credential,
      agentVersion: config.agentVersion,
      capabilities,
      resources: collectResourceUsage(),
      containers,
    });
    retryMs = 1_000;
  } catch (err) {
    console.error("[Agent] Poll failed:", err instanceof Error ? err.message : String(err));
    retryMs = Math.min(retryMs * 2, 60_000);
  }
};

setInterval(() => void poll(), 5_000);
void poll();

console.log(`[Agent] Connected as server ${stored.serverId.slice(0, 8)}${stored.wireguard ? " (WireGuard P2P)" : ""}`);