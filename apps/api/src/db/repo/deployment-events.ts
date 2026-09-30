import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { emitDeploymentFailed } from "../../events";
import type { FailureNotificationContext, RecordFailureInput, RecordFailureOutcome } from "../../types";
import { getDb } from "../db-provider";
import { deploymentEvents, deployments, projects } from "../schema";
import { applyStatusUpdate } from "./deployments";

const TERMINAL_TYPES = ["failed", "cancelled"];

export const createDeploymentEvent = async (input: {
	deploymentId: string;
	type: string;
	message?: string;
	metadata?: Record<string, unknown>;
}) => {
	const db = await getDb();
	const id = randomUUID();
	await db
		.insert(deploymentEvents)
		.values({
			id,
			deploymentId: input.deploymentId,
			type: input.type,
			message: input.message ?? null,
			metadata: input.metadata ?? null,
		})
		.execute();
	return id;
};

export const listDeploymentEvents = async (deploymentId: string) => {
	const db = await getDb();
	return db
		.select()
		.from(deploymentEvents)
		.where(eq(deploymentEvents.deploymentId, deploymentId))
		.orderBy(deploymentEvents.createdAt)
		.execute();
};

const recordTerminal = async (
	input: RecordFailureInput,
	type: "failed" | "cancelled",
): Promise<RecordFailureOutcome> => {
	const db = await getDb();
	const eventId = await db.transaction(async (tx) => {
		const [dep] = await tx
			.select({ id: deployments.id })
			.from(deployments)
			.where(eq(deployments.id, input.deploymentId))
			.for("update")
			.execute();
		if (!dep) return null;

		const [existing] = await tx
			.select({ id: deploymentEvents.id })
			.from(deploymentEvents)
			.where(and(eq(deploymentEvents.deploymentId, input.deploymentId), inArray(deploymentEvents.type, TERMINAL_TYPES)))
			.limit(1)
			.execute();
		if (existing) return null;

		const [inserted] = await tx
			.insert(deploymentEvents)
			.values({
				id: randomUUID(),
				deploymentId: input.deploymentId,
				type,
				message: input.reason,
				metadata: { source: input.source },
			})
			.onConflictDoNothing()
			.returning({ id: deploymentEvents.id })
			.execute();
		if (!inserted) return null;

		await applyStatusUpdate(tx, input.deploymentId, "failed", { failureReason: input.reason });
		return inserted.id;
	});

	if (eventId && type === "failed") {
		emitDeploymentFailed({ eventId, deploymentId: input.deploymentId });
	}
	return { claimed: eventId !== null, eventId };
};

export const recordDeploymentFailure = (input: RecordFailureInput): Promise<RecordFailureOutcome> =>
	recordTerminal({ ...input, cancel: false }, "failed");

export const recordDeploymentCancellation = (input: RecordFailureInput): Promise<RecordFailureOutcome> =>
	recordTerminal({ ...input, cancel: true }, "cancelled");

export const claimFailureNotification = async (eventId: string): Promise<FailureNotificationContext | null> => {
	const db = await getDb();
	const [claimed] = await db
		.update(deploymentEvents)
		.set({ attempts: sql`${deploymentEvents.attempts} + 1` })
		.where(
			and(
				eq(deploymentEvents.id, eventId),
				eq(deploymentEvents.type, "failed"),
				isNull(deploymentEvents.sentAt),
				lt(deploymentEvents.attempts, 3),
			),
		)
		.returning({ id: deploymentEvents.id })
		.execute();
	if (!claimed) return null;

	const [row] = await db
		.select({
			eventId: deploymentEvents.id,
			deploymentId: deploymentEvents.deploymentId,
			attempts: deploymentEvents.attempts,
			message: deploymentEvents.message,
			projectId: deployments.projectId,
			sourceRef: deployments.sourceRef,
			commitSha: deployments.commitSha,
			finishedAt: deployments.finishedAt,
			projectName: projects.name,
		})
		.from(deploymentEvents)
		.innerJoin(deployments, eq(deployments.id, deploymentEvents.deploymentId))
		.leftJoin(projects, eq(projects.id, deployments.projectId))
		.where(eq(deploymentEvents.id, eventId))
		.execute();
	if (!row) return null;

	return {
		eventId: row.eventId,
		deploymentId: row.deploymentId,
		projectId: row.projectId,
		projectName: row.projectName ?? row.sourceRef,
		failureReason: row.message,
		commitSha: row.commitSha,
		sourceRef: row.sourceRef,
		finishedAt: row.finishedAt ? new Date(row.finishedAt).toISOString() : null,
		attempt: row.attempts,
	};
};

export const markFailureNotificationSent = async (eventId: string): Promise<void> => {
	const db = await getDb();
	await db.update(deploymentEvents).set({ sentAt: new Date() }).where(eq(deploymentEvents.id, eventId)).execute();
};

export const listPendingFailureNotificationIds = async (limit = 20): Promise<string[]> => {
	const db = await getDb();
	const rows = await db
		.select({ id: deploymentEvents.id })
		.from(deploymentEvents)
		.where(and(eq(deploymentEvents.type, "failed"), isNull(deploymentEvents.sentAt), lt(deploymentEvents.attempts, 3)))
		.orderBy(asc(deploymentEvents.createdAt))
		.limit(limit)
		.execute();
	return rows.map((r) => r.id);
};

export interface ProjectEventRow {
	id: string;
	deploymentId: string;
	type: string;
	message: string | null;
	source: string | null;
	createdAt: string;
	deploymentStatus: string;
	commitSha: string | null;
	sourceRef: string;
	finishedAt: string | null;
	sentAt: string | null;
}

export const listProjectEvents = async (
	projectId: string,
	sinceIso: string,
	limit = 200,
): Promise<ProjectEventRow[]> => {
	const db = await getDb();
	const rows = await db
		.select({
			id: deploymentEvents.id,
			deploymentId: deploymentEvents.deploymentId,
			type: deploymentEvents.type,
			message: deploymentEvents.message,
			metadata: deploymentEvents.metadata,
			createdAt: deploymentEvents.createdAt,
			deploymentStatus: deployments.status,
			commitSha: deployments.commitSha,
			sourceRef: deployments.sourceRef,
			finishedAt: deployments.finishedAt,
			sentAt: deploymentEvents.sentAt,
		})
		.from(deploymentEvents)
		.innerJoin(deployments, eq(deployments.id, deploymentEvents.deploymentId))
		.where(and(eq(deployments.projectId, projectId), sql`${deploymentEvents.createdAt} >= ${sinceIso}`))
		.orderBy(desc(deploymentEvents.createdAt))
		.limit(limit)
		.execute();

	return rows.map((r) => ({
		id: r.id,
		deploymentId: r.deploymentId,
		type: r.type,
		message: r.message,
		source:
			r.metadata && typeof r.metadata === "object" && r.metadata !== null
				? ((r.metadata as Record<string, unknown>).source as string | null)
				: null,
		createdAt: new Date(r.createdAt).toISOString(),
		deploymentStatus: r.deploymentStatus,
		commitSha: r.commitSha,
		sourceRef: r.sourceRef,
		finishedAt: r.finishedAt ? new Date(r.finishedAt).toISOString() : null,
		sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : null,
	}));
};
