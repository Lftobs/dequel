import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db-provider";
import { restoreTests } from "../schema";

export type RestoreEventKind = "test" | "restore";

export interface RestoreTestRecord {
	id: string;
	backupId: string;
	targetId: string;
	serverId: string | null;
	kind: RestoreEventKind;
	status: string;
	error: string | null;
	startedAt: Date;
	completedAt: Date | null;
}

export async function createRestoreTestRecord(
	record: Pick<RestoreTestRecord, "id" | "backupId" | "targetId"> & {
		serverId?: string | null;
		kind?: RestoreEventKind;
	},
): Promise<RestoreTestRecord> {
	const db = await getDb();
	const [inserted] = await db
		.insert(restoreTests)
		.values({
			id: record.id,
			backupId: record.backupId,
			targetId: record.targetId,
			serverId: record.serverId ?? null,
			kind: record.kind ?? "test",
			status: "running",
			startedAt: new Date(),
		})
		.returning();
	return inserted as RestoreTestRecord;
}

export async function updateRestoreTestRecord(
	id: string,
	updates: Partial<Pick<RestoreTestRecord, "status" | "error" | "completedAt">>,
): Promise<RestoreTestRecord | null> {
	const db = await getDb();
	const [updated] = await db.update(restoreTests).set(updates).where(eq(restoreTests.id, id)).returning();
	return (updated as RestoreTestRecord) || null;
}

export async function getRestoreTestRecord(id: string): Promise<RestoreTestRecord | null> {
	const db = await getDb();
	const [record] = await db.select().from(restoreTests).where(eq(restoreTests.id, id)).limit(1);
	return (record as RestoreTestRecord) || null;
}

export interface RestoreTestFilters {
	backupId?: string;
	targetId?: string;
	status?: string;
	kind?: string;
	limit?: number;
}

export async function listRestoreTests(filters: RestoreTestFilters = {}): Promise<RestoreTestRecord[]> {
	const db = await getDb();
	const conditions = [];
	if (filters.backupId) conditions.push(eq(restoreTests.backupId, filters.backupId));
	if (filters.targetId) conditions.push(eq(restoreTests.targetId, filters.targetId));
	if (filters.status) conditions.push(eq(restoreTests.status, filters.status));
	if (filters.kind) conditions.push(eq(restoreTests.kind, filters.kind));
	let query = db
		.select()
		.from(restoreTests)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(desc(restoreTests.startedAt))
		.$dynamic();
	if (filters.limit) query = query.limit(filters.limit);
	return query as Promise<RestoreTestRecord[]>;
}
