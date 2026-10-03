import { and, eq } from "drizzle-orm";
import { getDb } from "../db-provider";
import { diagActions } from "../schema";
import { now } from "./helpers";

export type DiagActionKind = "pr" | "slack";
export type DiagActionStatus = "requested" | "executing" | "done" | "failed";

export interface DiagAction {
	key: string;
	runId: string;
	kind: DiagActionKind;
	status: DiagActionStatus;
	result: unknown;
	error: string | null;
	updatedAt: string;
}

const STALE_MS = 5 * 60_000;

const toAction = (row: typeof diagActions.$inferSelect): DiagAction => ({
	key: row.key,
	runId: row.runId,
	kind: row.kind as DiagActionKind,
	status: row.status as DiagActionStatus,
	result: row.result ?? null,
	error: row.error,
	updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
});

export const getDiagAction = async (key: string): Promise<DiagAction | null> => {
	const db = await getDb();
	const [row] = await db.select().from(diagActions).where(eq(diagActions.key, key)).execute();
	return row ? toAction(row) : null;
};

export const claimDiagAction = async (
	key: string,
	runId: string,
	kind: DiagActionKind,
): Promise<{ action: DiagAction; fresh: boolean }> => {
	const db = await getDb();
	const timestamp = now();
	const inserted = await db
		.insert(diagActions)
		.values({ key, runId, kind, status: "executing", updatedAt: timestamp })
		.onConflictDoNothing({ target: diagActions.key })
		.returning()
		.execute();
	if (inserted.length === 1) return { action: toAction(inserted[0]), fresh: true };
	const [row] = await db.select().from(diagActions).where(eq(diagActions.key, key)).execute();
	if (!row) throw new Error("Failed to claim diagnosis action");
	if (row.runId !== runId || row.kind !== kind) throw new Error("Action key already used for a different intent");
	const action = toAction(row);
	if (action.status === "done") return { action, fresh: false };
	if (action.status === "failed" || Date.now() - new Date(action.updatedAt).getTime() > STALE_MS) {
		const [claimed] = await db
			.update(diagActions)
			.set({ status: "executing", error: null, updatedAt: timestamp })
			.where(
				and(eq(diagActions.key, key), eq(diagActions.status, row.status), eq(diagActions.updatedAt, row.updatedAt)),
			)
			.returning()
			.execute();
		if (!claimed) return { action, fresh: false };
		return { action: toAction(claimed), fresh: true };
	}
	return { action, fresh: false };
};

export const completeDiagAction = async (key: string, result: unknown): Promise<void> => {
	const db = await getDb();
	await db
		.update(diagActions)
		.set({ status: "done", result: result as object, error: null, updatedAt: now() })
		.where(eq(diagActions.key, key))
		.execute();
};

export const failDiagAction = async (key: string, error: string): Promise<void> => {
	const db = await getDb();
	await db
		.update(diagActions)
		.set({ status: "failed", error, updatedAt: now() })
		.where(eq(diagActions.key, key))
		.execute();
};

export const findCompletedAction = async (runId: string, kind: DiagActionKind): Promise<DiagAction | null> => {
	const db = await getDb();
	const [row] = await db
		.select()
		.from(diagActions)
		.where(and(eq(diagActions.runId, runId), eq(diagActions.kind, kind), eq(diagActions.status, "done")))
		.execute();
	return row ? toAction(row) : null;
};
