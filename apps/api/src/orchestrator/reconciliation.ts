import { getDb } from "../db/db-provider";
import { agentJobs, servers, deployments } from "../db/schema";
import { and, eq, lt } from "drizzle-orm";

const LEASE_RECOVERY_INTERVAL_MS = 30_000;
const STALE_AGENT_THRESHOLD_MS = 5 * 60 * 1000;
const ABANDONED_JOB_THRESHOLD_MS = 30 * 60 * 1000;

export const startReconciliation = () => {
  setInterval(reclaimExpiredLeases, LEASE_RECOVERY_INTERVAL_MS);
  console.log("[Reconciliation] Started lease recovery loop (every 30s)");
};

export const startStaleAgentCleanup = () => {
  setInterval(cleanStaleAgents, 60_000);
  console.log("[Reconciliation] Started stale agent cleanup (every 60s)");
};

export const startAbandonedJobCleanup = () => {
  setInterval(cleanAbandonedJobs, 120_000);
  console.log("[Reconciliation] Started abandoned job cleanup (every 120s)");
};

const reclaimExpiredLeases = async () => {
  try {
    const db = await getDb();
    const now = new Date();

    const expiredLeases = await db.select().from(agentJobs)
      .where(
        and(
          eq(agentJobs.status, "leased"),
          lt(agentJobs.leaseExpiresAt, now),
        )
      )
      .execute();

    for (const job of expiredLeases) {
      await db.update(agentJobs).set({
        status: "queued",
        leaseId: null,
        leaseExpiresAt: null,
        attempts: job.attempts + 1,
      }).where(eq(agentJobs.id, job.id)).execute();

      console.log(`[Reconciliation] Reclaimed expired lease for job ${job.id} (attempt ${job.attempts + 1})`);
    }

    if (expiredLeases.length > 0) {
      console.log(`[Reconciliation] Reclaimed ${expiredLeases.length} expired lease(s)`);
    }
  } catch (err) {
    console.error("[Reconciliation] Lease recovery failed:", err);
  }
};

const cleanStaleAgents = async () => {
  try {
    const db = await getDb();
    const threshold = new Date(Date.now() - STALE_AGENT_THRESHOLD_MS);

    const staleAgents = await db.select().from(servers)
      .where(
        and(
          eq(servers.mode, "agent"),
          eq(servers.status, "online"),
          lt(servers.lastHeartbeat, threshold),
        )
      )
      .execute();

    for (const server of staleAgents) {
      await db.update(servers).set({
        status: "offline",
        updatedAt: new Date(),
      }).where(eq(servers.id, server.id)).execute();

      const heartbeatAge = server.lastHeartbeat
        ? Math.round((Date.now() - server.lastHeartbeat.getTime()) / 1000)
        : "unknown";
      console.log(`[Reconciliation] Marked agent ${server.name} (${server.id}) as offline — no heartbeat for ${heartbeatAge}s`);
    }
  } catch (err) {
    console.error("[Reconciliation] Stale agent cleanup failed:", err);
  }
};

const cleanAbandonedJobs = async () => {
  try {
    const db = await getDb();
    const threshold = new Date(Date.now() - ABANDONED_JOB_THRESHOLD_MS);

    const stuckJobs = await db.select().from(agentJobs)
      .where(
        and(
          eq(agentJobs.status, "running"),
          lt(agentJobs.startedAt, threshold),
        )
      )
      .execute();

    for (const job of stuckJobs) {
      await db.update(agentJobs).set({
        status: "failed",
        failureReason: "Job abandoned — no completion within 30 minutes",
        finishedAt: new Date(),
      }).where(eq(agentJobs.id, job.id)).execute();

      if (job.deploymentId) {
        await db.update(deployments).set({
          status: "failed",
          failureReason: "Agent job abandoned",
          finishedAt: new Date(),
        }).where(eq(deployments.id, job.deploymentId)).execute();
      }

      console.log(`[Reconciliation] Cleaned abandoned job ${job.id} (started ${job.startedAt})`);
    }
  } catch (err) {
    console.error("[Reconciliation] Abandoned job cleanup failed:", err);
  }
};
