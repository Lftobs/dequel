import { randomUUID } from "node:crypto";
import { and, eq, or, lt, isNull } from "drizzle-orm";
import { agentJobs } from "../schema";
import { getDrizzle } from "../drizzle";
import { now } from "./helpers";
import type { AgentJobEnvelope } from "../../agents/protocol";

type AgentJobType = AgentJobEnvelope["type"];

export const createAgentJob = async (input: {
  deploymentId?: string | null;
  serverId: string;
  type: AgentJobType;
  payload: unknown;
  idempotencyKey: string;
}) => {
  const db = await getDrizzle();
  const id = randomUUID();
  db.insert(agentJobs).values({
    id,
    deploymentId: input.deploymentId ?? null,
    serverId: input.serverId,
    type: input.type,
    payload: JSON.stringify(input.payload),
    idempotencyKey: input.idempotencyKey,
    createdAt: now(),
  }).run();
  return id;
};

export const leaseNextAgentJob = async (serverId: string, leaseMs = 30_000): Promise<AgentJobEnvelope | null> => {
  const db = await getDrizzle();
  const timestamp = now();
  const row = db.select().from(agentJobs).where(and(
    eq(agentJobs.serverId, serverId),
    or(eq(agentJobs.status, "queued"), and(eq(agentJobs.status, "leased"), or(isNull(agentJobs.leaseExpiresAt), lt(agentJobs.leaseExpiresAt, timestamp)))),
  )).orderBy(agentJobs.createdAt).get();
  if (!row) return null;
  const leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();
  const leaseId = randomUUID();
  const sameLease = row.leaseId ? eq(agentJobs.leaseId, row.leaseId) : isNull(agentJobs.leaseId);
  const leased = db.update(agentJobs).set({
    status: "leased",
    attempts: row.attempts + 1,
    leaseId,
    leaseExpiresAt,
  }).where(and(eq(agentJobs.id, row.id), eq(agentJobs.status, row.status), sameLease)).run();
  if (leased.changes !== 1) return null;
  return {
    id: row.id,
    deploymentId: row.deploymentId,
    type: row.type as AgentJobType,
    payload: JSON.parse(row.payload),
    leaseId,
    leaseExpiresAt,
    idempotencyKey: row.idempotencyKey,
  };
};

export const acknowledgeAgentJob = async (jobId: string, serverId: string, leaseId: string) => {
  const db = await getDrizzle();
  return db.update(agentJobs).set({ status: "running", startedAt: now() })
    .where(and(eq(agentJobs.id, jobId), eq(agentJobs.serverId, serverId), eq(agentJobs.leaseId, leaseId), eq(agentJobs.status, "leased"))).run().changes === 1;
};

export const getAgentJobDeploymentId = async (jobId: string, serverId: string, leaseId: string) => {
  const db = await getDrizzle();
  return db.select({ deploymentId: agentJobs.deploymentId }).from(agentJobs)
    .where(and(eq(agentJobs.id, jobId), eq(agentJobs.serverId, serverId), eq(agentJobs.leaseId, leaseId), eq(agentJobs.status, "running"))).get()?.deploymentId ?? null;
};

export const getAgentJobInfo = async (jobId: string, serverId: string, leaseId: string) => {
  const db = await getDrizzle();
  const row = db.select({ deploymentId: agentJobs.deploymentId, type: agentJobs.type, payload: agentJobs.payload }).from(agentJobs)
    .where(and(eq(agentJobs.id, jobId), eq(agentJobs.serverId, serverId), eq(agentJobs.leaseId, leaseId), eq(agentJobs.status, "running"))).get();
  if (!row) return null;
  return { deploymentId: row.deploymentId, type: row.type, payload: JSON.parse(row.payload) };
};

export const finishAgentJob = async (jobId: string, serverId: string, leaseId: string, success: boolean, error?: string) => {
  const db = await getDrizzle();
  return db.update(agentJobs).set({
    status: success ? "succeeded" : "failed",
    failureReason: success ? null : error || "Agent job failed",
    finishedAt: now(),
    leaseId: null,
    leaseExpiresAt: null,
  }).where(and(eq(agentJobs.id, jobId), eq(agentJobs.serverId, serverId), eq(agentJobs.leaseId, leaseId), or(eq(agentJobs.status, "running"), eq(agentJobs.status, "cancelled")))).run().changes === 1;
};

export const cancelAgentJobsByDeploymentId = async (deploymentId: string) => {
  const db = await getDrizzle();
  return db.update(agentJobs).set({ status: "cancelled" })
    .where(and(eq(agentJobs.deploymentId, deploymentId), or(eq(agentJobs.status, "queued"), eq(agentJobs.status, "leased"), eq(agentJobs.status, "running")))).run().changes;
};

export const listCancelledJobIds = async (serverId: string) => {
  const db = await getDrizzle();
  return db.select({ id: agentJobs.id }).from(agentJobs)
    .where(and(eq(agentJobs.serverId, serverId), eq(agentJobs.status, "cancelled"))).all().map((row) => row.id);
};

export const requeueRunningAgentJobs = async (serverId: string) => {
  const db = await getDrizzle();
  return db.update(agentJobs).set({
    status: "queued",
    leaseId: null,
    leaseExpiresAt: null,
    startedAt: null,
  }).where(and(eq(agentJobs.serverId, serverId), eq(agentJobs.status, "running"))).run().changes;
};
