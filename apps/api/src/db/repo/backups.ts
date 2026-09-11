import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db-provider";
import { backups } from "../schema";

export interface BackupRecord {
	id: string;
	targetId: string;
	targetType: string;
	engine: string;
	filename: string | null;
	storageType: string;
	storagePath: string | null;
	sizeBytes: number | null;
	error: string | null;
	status: string;
	createdAt: Date;
	completedAt: Date | null;
}

export async function createBackupRecord(
	record: Omit<BackupRecord, "createdAt" | "completedAt">,
): Promise<BackupRecord> {
	const db = await getDb();
	const [inserted] = await db
		.insert(backups)
		.values({
			...record,
			createdAt: new Date(),
		})
		.returning();

	return inserted as BackupRecord;
}

export async function getBackupRecord(id: string): Promise<BackupRecord | null> {
	const db = await getDb();
	const [record] = await db.select().from(backups).where(eq(backups.id, id)).limit(1);
	return (record as BackupRecord) || null;
}

export async function updateBackupRecord(id: string, updates: Partial<BackupRecord>): Promise<BackupRecord | null> {
	const db = await getDb();
	const [updated] = await db.update(backups).set(updates).where(eq(backups.id, id)).returning();

	return (updated as BackupRecord) || null;
}

export async function deleteBackupRecord(id: string): Promise<void> {
	const db = await getDb();
	await db.delete(backups).where(eq(backups.id, id));
}

export async function listBackupRecords(targetId?: string): Promise<BackupRecord[]> {
	const db = await getDb();
	if (targetId) {
		return db.select().from(backups).where(eq(backups.targetId, targetId)).orderBy(desc(backups.createdAt)) as Promise<
			BackupRecord[]
		>;
	}

	return db.select().from(backups).orderBy(desc(backups.createdAt)) as Promise<BackupRecord[]>;
}

export async function listCompletedBackupsForTarget(targetId: string): Promise<BackupRecord[]> {
	const db = await getDb();
	return db
		.select()
		.from(backups)
		.where(and(eq(backups.targetId, targetId), eq(backups.status, "completed")))
		.orderBy(desc(backups.createdAt)) as Promise<BackupRecord[]>;
}
