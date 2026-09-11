import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { CreateDeploymentInput, Deployment, DeploymentLog, DeploymentStatus, LogEvent } from "../../types";
import { getDb } from "../db-provider";
import { deploymentLogs, deployments } from "../schema";
import { formatTimestamp, getRowsAffected, now } from "./helpers";

const mapDeployment = (row: typeof deployments.$inferSelect): Deployment => ({
	id: row.id,
	projectId: row.projectId,
	serverId: row.serverId ?? null,
	sourceType: row.sourceType as Deployment["sourceType"],
	sourceRef: row.sourceRef,
	status: row.status as DeploymentStatus,
	imageTag: row.imageTag,
	containerName: row.containerName,
	routePath: row.routePath,
	liveUrl: row.liveUrl,
	branch: row.branch,
	commitSha: row.commitSha,
	replicas: row.replicas,
	environment: row.environment,
	failureReason: row.failureReason,
	clearCache: Boolean(row.clearCache),
	finishedAt: row.finishedAt ? formatTimestamp(row.finishedAt) : null,
	createdAt: formatTimestamp(row.createdAt),
	updatedAt: formatTimestamp(row.updatedAt),
});

export const createDeployment = async (input: CreateDeploymentInput): Promise<Deployment> => {
	const id = randomUUID();
	const timestamp = now();
	const db = await getDb();
	await db
		.insert(deployments)
		.values({
			id,
			projectId: input.projectId ?? null,
			serverId: input.serverId ?? null,
			sourceType: input.sourceType,
			sourceRef: input.sourceRef,
			status: "pending",
			routePath: `/apps/${id}`,
			branch: input.branch ?? null,
			commitSha: input.commitSha ?? null,
			environment: input.environment ?? null,
			clearCache: !!input.clearCache,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		.execute();
	const [row] = await db.select().from(deployments).where(eq(deployments.id, id)).execute();
	return mapDeployment(row);
};

export const listDeployments = async (projectId?: string, offset = 0, limit = 50): Promise<Deployment[]> => {
	const db = await getDb();
	const rows = projectId
		? await db
				.select()
				.from(deployments)
				.where(eq(deployments.projectId, projectId))
				.orderBy(desc(deployments.createdAt))
				.limit(limit)
				.offset(offset)
				.execute()
		: await db.select().from(deployments).orderBy(desc(deployments.createdAt)).limit(limit).offset(offset).execute();
	return rows.map(mapDeployment);
};

export const countDeployments = async (projectId?: string): Promise<number> => {
	const db = await getDb();
	const rows = projectId
		? await db.select().from(deployments).where(eq(deployments.projectId, projectId)).execute()
		: await db.select().from(deployments).execute();
	return rows.length;
};

export const getDeploymentById = async (id: string): Promise<Deployment | null> => {
	const db = await getDb();
	const [row] = await db.select().from(deployments).where(eq(deployments.id, id)).execute();
	return row ? mapDeployment(row) : null;
};

export const updateDeploymentCommitSha = async (id: string, commitSha: string) => {
	const db = await getDb();
	await db.update(deployments).set({ commitSha, updatedAt: now() }).where(eq(deployments.id, id)).execute();
};

const ACTIVE_STATUSES: DeploymentStatus[] = ["pending", "building", "deploying"];

const STAMP_FINISHED_UNCONDITIONALLY: DeploymentStatus[] = ["running", "failed"];

export const updateDeploymentStatus = async (
	id: string,
	status: DeploymentStatus,
	patch: Partial<Pick<Deployment, "imageTag" | "containerName" | "liveUrl" | "failureReason" | "replicas">> = {},
) => {
	const db = await getDb();
	const [existing] = await db
		.select({ finishedAt: deployments.finishedAt })
		.from(deployments)
		.where(eq(deployments.id, id))
		.execute();
	const updates: Record<string, unknown> = { status, updatedAt: now() };
	if (patch.imageTag !== undefined) updates.imageTag = patch.imageTag;
	if (patch.containerName !== undefined) updates.containerName = patch.containerName;
	if (patch.liveUrl !== undefined) updates.liveUrl = patch.liveUrl;
	if (patch.failureReason !== undefined) updates.failureReason = patch.failureReason;
	if (patch.replicas !== undefined) updates.replicas = patch.replicas;
	if (!ACTIVE_STATUSES.includes(status)) {
		if (!existing?.finishedAt) {
			updates.finishedAt = now();
		} else if (STAMP_FINISHED_UNCONDITIONALLY.includes(status)) {
			updates.finishedAt = now();
		}
	}
	await db.update(deployments).set(updates).where(eq(deployments.id, id)).execute();
};

export const deleteDeploymentAndLogs = async (id: string): Promise<boolean> => {
	const db = await getDb();
	await db.delete(deploymentLogs).where(eq(deploymentLogs.deploymentId, id)).execute();
	const result = await db.delete(deployments).where(eq(deployments.id, id)).execute();
	return getRowsAffected(result) > 0;
};

const seqMap = new Map<string, number>();

export const appendLog = async (
	deploymentId: string,
	stage: LogEvent["stage"],
	message: string,
): Promise<DeploymentLog> => {
	const db = await getDb();
	if (!seqMap.has(deploymentId)) {
		const [row] = await db
			.select({ maxSeq: deploymentLogs.sequence })
			.from(deploymentLogs)
			.where(eq(deploymentLogs.deploymentId, deploymentId))
			.orderBy(desc(deploymentLogs.sequence))
			.limit(1)
			.execute();
		seqMap.set(deploymentId, row?.maxSeq ?? 0);
	}
	const sequence = (seqMap.get(deploymentId) ?? 0) + 1;
	seqMap.set(deploymentId, sequence);

	const createdAt = now();
	const [inserted] = await db
		.insert(deploymentLogs)
		.values({
			deploymentId,
			sequence,
			stage,
			message,
			createdAt,
		})
		.returning({ id: deploymentLogs.id });
	return {
		id: inserted.id,
		deploymentId,
		sequence,
		stage: stage as DeploymentLog["stage"],
		message,
		createdAt,
	};
};

export const getLogs = async (deploymentId: string): Promise<DeploymentLog[]> => {
	const db = await getDb();
	const rows = await db
		.select()
		.from(deploymentLogs)
		.where(eq(deploymentLogs.deploymentId, deploymentId))
		.orderBy(deploymentLogs.sequence)
		.execute();
	return rows.map((r) => ({
		id: r.id,
		deploymentId: r.deploymentId,
		sequence: r.sequence,
		stage: r.stage as DeploymentLog["stage"],
		message: r.message,
		createdAt: r.createdAt,
	}));
};
