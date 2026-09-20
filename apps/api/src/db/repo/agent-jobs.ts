import { randomUUID } from "node:crypto";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import type { AgentJobEnvelope } from "../../agents/protocol";
import { getDb } from "../db-provider";
import { agentJobs } from "../schema";
import { getRowsAffected, now } from "./helpers";

type AgentJobType = AgentJobEnvelope["type"];

export const createAgentJob = async (input: {
	deploymentId?: string | null;
	serverId: string;
	type: AgentJobType;
	payload: unknown;
	idempotencyKey: string;
}) => {
	const db = await getDb();
	const existing = (
		await db
			.select({ id: agentJobs.id })
			.from(agentJobs)
			.where(eq(agentJobs.idempotencyKey, input.idempotencyKey))
			.execute()
	)[0];
	if (existing) return existing.id;
	const id = randomUUID();
	await db
		.insert(agentJobs)
		.values({
			id,
			deploymentId: input.deploymentId ?? null,
			serverId: input.serverId,
			type: input.type,
			payload: input.payload,
			idempotencyKey: input.idempotencyKey,
			createdAt: now(),
		})
		.execute();
	return id;
};

export const leaseNextAgentJob = async (serverId: string, leaseMs = 30_000): Promise<AgentJobEnvelope | null> => {
	const db = await getDb();
	const timestamp = now();
	const [row] = await db
		.select()
		.from(agentJobs)
		.where(
			and(
				eq(agentJobs.serverId, serverId),
				or(
					eq(agentJobs.status, "queued"),
					and(
						eq(agentJobs.status, "leased"),
						or(isNull(agentJobs.leaseExpiresAt), lt(agentJobs.leaseExpiresAt, timestamp)),
					),
				),
			),
		)
		.orderBy(agentJobs.createdAt)
		.execute();
	if (!row) return null;
	const leaseExpiresAt = new Date(Date.now() + leaseMs);
	const leaseId = randomUUID();
	const sameLease = row.leaseId ? eq(agentJobs.leaseId, row.leaseId) : isNull(agentJobs.leaseId);
	const leased = await db
		.update(agentJobs)
		.set({
			status: "leased",
			attempts: row.attempts + 1,
			leaseId,
			leaseExpiresAt,
		})
		.where(and(eq(agentJobs.id, row.id), eq(agentJobs.status, row.status), sameLease))
		.execute();
	if (getRowsAffected(leased) !== 1) return null;
	return {
		id: row.id,
		deploymentId: row.deploymentId,
		type: row.type as AgentJobType,
		payload: row.payload,
		leaseId,
		leaseExpiresAt: leaseExpiresAt.toISOString(),
		idempotencyKey: row.idempotencyKey,
	};
};

export const acknowledgeAgentJob = async (jobId: string, serverId: string, leaseId: string) => {
	const db = await getDb();
	const result = await db
		.update(agentJobs)
		.set({ status: "running", startedAt: now() })
		.where(
			and(
				eq(agentJobs.id, jobId),
				eq(agentJobs.serverId, serverId),
				eq(agentJobs.leaseId, leaseId),
				eq(agentJobs.status, "leased"),
			),
		)
		.execute();
	return getRowsAffected(result) === 1;
};

export const getAgentJobDeploymentId = async (jobId: string, serverId: string, leaseId: string) => {
	const db = await getDb();
	const [row] = await db
		.select({ deploymentId: agentJobs.deploymentId })
		.from(agentJobs)
		.where(
			and(
				eq(agentJobs.id, jobId),
				eq(agentJobs.serverId, serverId),
				eq(agentJobs.leaseId, leaseId),
				eq(agentJobs.status, "running"),
			),
		)
		.execute();
	return row?.deploymentId ?? null;
};

export const getAgentJobInfo = async (jobId: string, serverId: string, leaseId: string) => {
	const db = await getDb();
	const [row] = await db
		.select({ deploymentId: agentJobs.deploymentId, type: agentJobs.type, payload: agentJobs.payload })
		.from(agentJobs)
		.where(
			and(
				eq(agentJobs.id, jobId),
				eq(agentJobs.serverId, serverId),
				eq(agentJobs.leaseId, leaseId),
				eq(agentJobs.status, "running"),
			),
		)
		.execute();
	if (!row) return null;
	return { deploymentId: row.deploymentId, type: row.type, payload: row.payload };
};

export const finishAgentJob = async (
	jobId: string,
	serverId: string,
	leaseId: string,
	success: boolean,
	error?: string,
) => {
	const db = await getDb();
	const result = await db
		.update(agentJobs)
		.set({
			status: success ? "succeeded" : "failed",
			failureReason: success ? null : error || "Agent job failed",
			finishedAt: now(),
			leaseId: null,
			leaseExpiresAt: null,
		})
		.where(
			and(
				eq(agentJobs.id, jobId),
				eq(agentJobs.serverId, serverId),
				eq(agentJobs.leaseId, leaseId),
				or(eq(agentJobs.status, "running"), eq(agentJobs.status, "cancelled")),
			),
		)
		.execute();
	return getRowsAffected(result) === 1;
};

export const cancelAgentJobsByDeploymentId = async (deploymentId: string) => {
	const db = await getDb();
	const timestamp = now();
	const finished = db
		.update(agentJobs)
		.set({
			status: "failed",
			failureReason: "Cancelled",
			finishedAt: timestamp,
			leaseId: null,
			leaseExpiresAt: null,
		})
		.where(and(eq(agentJobs.deploymentId, deploymentId), eq(agentJobs.status, "queued")))
		.execute();
	const cancelled = db
		.update(agentJobs)
		.set({ status: "cancelled" })
		.where(
			and(
				eq(agentJobs.deploymentId, deploymentId),
				or(eq(agentJobs.status, "leased"), eq(agentJobs.status, "running")),
			),
		)
		.execute();
	const [f, c] = await Promise.all([finished, cancelled]);
	return getRowsAffected(f) + getRowsAffected(c);
};

export const listCancelledJobIds = async (serverId: string) => {
	const db = await getDb();
	const rows = await db
		.select({ id: agentJobs.id })
		.from(agentJobs)
		.where(and(eq(agentJobs.serverId, serverId), eq(agentJobs.status, "cancelled"), isNotNull(agentJobs.leaseId)))
		.execute();
	return rows.map((row) => row.id);
};

export const requeueRunningAgentJobs = async (serverId: string) => {
	const db = await getDb();
	const result = await db
		.update(agentJobs)
		.set({
			status: "queued",
			leaseId: null,
			leaseExpiresAt: null,
			startedAt: null,
		})
		.where(and(eq(agentJobs.serverId, serverId), eq(agentJobs.status, "running")))
		.execute();
	return getRowsAffected(result);
};
