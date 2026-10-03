import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { CauseKind, DiagRun, DiagStageName, DiagStatus, Proposal } from "../../fixdiag/types";
import { getDb } from "../db-provider";
import { deployments, diagRuns, diagStages, projects } from "../schema";
import { now } from "./helpers";

const toRun = (row: typeof diagRuns.$inferSelect): DiagRun => ({
	id: row.id,
	deploymentId: row.deploymentId,
	commitSha: row.commitSha,
	provider: row.provider as DiagRun["provider"],
	model: row.model,
	status: row.status as DiagStatus,
	currentStage: row.currentStage as DiagStageName | null,
	cause: row.cause as CauseKind | null,
	report: (row.report as Proposal | null) ?? null,
	error: row.error,
	createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
});

export const findDiagRun = async (deploymentId: string, commitSha: string): Promise<DiagRun | null> => {
	const db = await getDb();
	const [row] = await db
		.select()
		.from(diagRuns)
		.where(and(eq(diagRuns.deploymentId, deploymentId), eq(diagRuns.commitSha, commitSha)))
		.execute();
	return row ? toRun(row) : null;
};

export const getDiagRun = async (runId: string): Promise<DiagRun | null> => {
	const db = await getDb();
	const [row] = await db.select().from(diagRuns).where(eq(diagRuns.id, runId)).execute();
	return row ? toRun(row) : null;
};

export const createDiagRun = async (input: {
	deploymentId: string;
	commitSha: string;
	provider: DiagRun["provider"];
	model: string;
}): Promise<DiagRun> => {
	const db = await getDb();
	const [inserted] = await db
		.insert(diagRuns)
		.values({
			id: randomUUID(),
			deploymentId: input.deploymentId,
			commitSha: input.commitSha,
			provider: input.provider,
			model: input.model,
		})
		.returning()
		.execute();
	return toRun(inserted);
};

export const deleteDiagRun = async (runId: string): Promise<void> => {
	const db = await getDb();
	await db.delete(diagRuns).where(eq(diagRuns.id, runId)).execute();
};

export const recordStageResult = async (runId: string, stage: DiagStageName, payload: unknown): Promise<void> => {
	const db = await getDb();
	await db
		.insert(diagStages)
		.values({ id: randomUUID(), runId, stage, payload: payload as object })
		.onConflictDoUpdate({ target: [diagStages.runId, diagStages.stage], set: { payload: payload as object } })
		.execute();
	await db.update(diagRuns).set({ currentStage: stage, updatedAt: now() }).where(eq(diagRuns.id, runId)).execute();
};

export const getStagePayload = async (runId: string, stage: DiagStageName): Promise<unknown> => {
	const db = await getDb();
	const [row] = await db
		.select()
		.from(diagStages)
		.where(and(eq(diagStages.runId, runId), eq(diagStages.stage, stage)))
		.execute();
	return row?.payload ?? null;
};

export const listStageResults = async (runId: string): Promise<{ stage: DiagStageName; payload: unknown }[]> => {
	const db = await getDb();
	const rows = await db.select().from(diagStages).where(eq(diagStages.runId, runId)).execute();
	return rows.map((r) => ({ stage: r.stage as DiagStageName, payload: r.payload ?? null }));
};

export const finishDiagRun = async (
	runId: string,
	status: DiagStatus,
	cause: CauseKind | null,
	report: Proposal | null,
	error: string | null,
): Promise<void> => {
	const db = await getDb();
	await db
		.update(diagRuns)
		.set({ status, cause, report: report as object | null, error, updatedAt: now() })
		.where(eq(diagRuns.id, runId))
		.execute();
};

export interface ActiveDiagRun {
	id: string;
	deploymentId: string;
	projectId: string | null;
	projectName: string | null;
	provider: string;
	model: string;
	currentStage: DiagStageName | null;
	createdAt: string;
}

export const listActiveDiagRuns = async (): Promise<ActiveDiagRun[]> => {
	const db = await getDb();
	const rows = await db
		.select({
			id: diagRuns.id,
			deploymentId: diagRuns.deploymentId,
			projectId: deployments.projectId,
			projectName: projects.name,
			provider: diagRuns.provider,
			model: diagRuns.model,
			currentStage: diagRuns.currentStage,
			createdAt: diagRuns.createdAt,
		})
		.from(diagRuns)
		.leftJoin(deployments, eq(diagRuns.deploymentId, deployments.id))
		.leftJoin(projects, eq(deployments.projectId, projects.id))
		.where(eq(diagRuns.status, "running"))
		.execute();
	return rows.map((row) => ({
		id: row.id,
		deploymentId: row.deploymentId,
		projectId: row.projectId,
		projectName: row.projectName,
		provider: row.provider,
		model: row.model,
		currentStage: row.currentStage as DiagStageName | null,
		createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
	}));
};

export const markInterruptedDiagRuns = async (): Promise<number> => {
	const active = await listActiveDiagRuns();
	for (const run of active) {
		await finishDiagRun(
			run.id,
			"error",
			null,
			null,
			"Diagnosis interrupted by API restart; start it again from the deployment.",
		);
	}
	return active.length;
};
