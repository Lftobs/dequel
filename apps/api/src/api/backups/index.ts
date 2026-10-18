import { randomUUID } from "node:crypto";
import { Elysia } from "elysia";
import { BackupOrchestrator } from "../../backup/orchestrator";
import { runRestoreTest } from "../../backup/restore-test";
import type { BackupTarget, StorageConfig } from "../../backup/types";
import { S3_BACKUP_PREFIX } from "../../backup/types";
import { deleteBackupRecord, getBackupRecord, listBackupRecords } from "../../db/repo/backups";
import { getDatabaseById } from "../../db/repo/databases";
import { createRestoreTestRecord, listRestoreTests, updateRestoreTestRecord } from "../../db/repo/restore-tests";
import { getBackupStorageSettings } from "../../db/repo/settings";
import { created, fail, ok } from "../response";

const DEFAULT_RETENTION = 7;

async function loadStorageConfig(): Promise<StorageConfig> {
	const settings = await getBackupStorageSettings();
	if (settings.type === "s3") {
		return {
			type: "s3",
			endpoint: settings.s3Endpoint,
			accessKeyId: settings.s3AccessKeyId,
			secretAccessKey: settings.s3SecretAccessKey,
			bucket: settings.s3Bucket,
			region: settings.s3Region,
			prefix: S3_BACKUP_PREFIX,
		};
	}
	return { type: "local", path: settings.path };
}

async function getRetentionCount(targetId?: string): Promise<number> {
	if (targetId && targetId !== "internal") {
		const db = await getDatabaseById(targetId);
		if (db) return db.backupRetention ?? DEFAULT_RETENTION;
	}
	return DEFAULT_RETENTION;
}

async function resolveTarget(targetId: string): Promise<BackupTarget> {
	if (targetId === "internal") {
		return {
			id: "internal",
			type: "internal",
			engine: "postgresql",
			containerName: process.env.POSTGRES_CONTAINER || "dequel-postgres-1",
			databaseName: process.env.POSTGRES_DB || "dequel",
			serverId: null,
			credentials: {
				username: process.env.POSTGRES_USER || "dequel",
				password: process.env.POSTGRES_PASSWORD || "dequel",
			},
		};
	}

	const db = await getDatabaseById(targetId);
	if (!db) throw new Error(`Database ${targetId} not found`);
	if (!db.containerName) throw new Error(`Database ${targetId} has no container`);

	return {
		id: db.id,
		type: "managed",
		engine: db.type as BackupTarget["engine"],
		containerName: db.containerName,
		databaseName: db.databaseName,
		serverId: db.serverId,
		credentials: {
			username: db.username,
			password: db.password,
		},
	};
}

export const backupRoutes = new Elysia({ prefix: "/backups" })
	.get("/", async () => {
		const records = await listBackupRecords();
		return ok(records);
	})
	.get("/config", async () => {
		const settings = await getBackupStorageSettings();
		return ok(settings);
	})
	.post("/", async ({ set }) => {
		try {
			const storage = await loadStorageConfig();
			const orchestrator = new BackupOrchestrator(storage);
			const job = await orchestrator.backup("internal", DEFAULT_RETENTION, resolveTarget);
			return created(job);
		} catch (error) {
			set.status = 500;
			return fail(String(error));
		}
	})
	.post("/:id/trigger", async ({ params, set }) => {
		try {
			const storage = await loadStorageConfig();
			const retention = await getRetentionCount(params.id);
			const orchestrator = new BackupOrchestrator(storage);
			const job = await orchestrator.backup(params.id, retention, resolveTarget);
			return created(job);
		} catch (error) {
			set.status = 500;
			return fail(String(error));
		}
	})
	.get("/:id", async ({ params, set }) => {
		const record = await getBackupRecord(params.id);
		if (!record) {
			set.status = 404;
			return fail("Backup not found");
		}
		return ok(record);
	})
	.delete("/:id", async ({ params, set }) => {
		const record = await getBackupRecord(params.id);
		if (!record) {
			set.status = 404;
			return fail("Backup not found");
		}
		await deleteBackupRecord(params.id);
		return ok({ deleted: true });
	})
	.post("/:id/restore", async ({ params, set }) => {
		const record = await getBackupRecord(params.id);
		if (!record) {
			set.status = 404;
			return fail("Backup not found");
		}
		let serverId: string | null = null;
		if (record.targetId !== "internal") {
			const db = await getDatabaseById(record.targetId);
			serverId = db?.serverId ?? null;
		}
		const event = await createRestoreTestRecord({
			id: randomUUID(),
			backupId: record.id,
			targetId: record.targetId,
			serverId,
			kind: "restore",
		});
		let restoreError: unknown = null;
		try {
			const storage = await loadStorageConfig();
			const orchestrator = new BackupOrchestrator(storage);
			await orchestrator.restore(params.id, resolveTarget);
		} catch (error) {
			restoreError = error;
		}
		try {
			await updateRestoreTestRecord(event.id, {
				status: restoreError ? "failed" : "passed",
				error: restoreError ? String(restoreError) : null,
				completedAt: new Date(),
			});
		} catch (eventError) {
			console.error(`[backups] failed to record restore event ${event.id}:`, eventError);
		}
		if (restoreError) {
			set.status = 500;
			return fail(String(restoreError));
		}
		return ok({ restored: true });
	})
	.post("/:id/restore-test", async ({ params, body, set }: any) => {
		try {
			const record = await getBackupRecord(params.id);
			if (!record) {
				set.status = 404;
				return fail("Backup not found");
			}
			const test = await runRestoreTest({ backupId: params.id, serverId: body?.serverId ?? null });
			if (test?.status !== "passed") {
				set.status = 500;
				return fail(test?.error || "Restore test failed");
			}
			return created(test);
		} catch (error) {
			set.status = 500;
			return fail(String(error));
		}
	})
	.get("/restore-tests", async ({ query }: any) => {
		const limit = query?.limit ? Number(query.limit) : undefined;
		return ok(
			await listRestoreTests({
				backupId: query?.backupId,
				targetId: query?.targetId,
				status: query?.status,
				kind: query?.kind,
				limit: Number.isInteger(limit) && (limit as number) > 0 ? limit : undefined,
			}),
		);
	})
	.get("/:id/restore-tests", async ({ params, query }: any) => {
		const limit = query?.limit ? Number(query.limit) : undefined;
		return ok(
			await listRestoreTests({
				backupId: params.id,
				status: query?.status,
				kind: query?.kind,
				limit: Number.isInteger(limit) && (limit as number) > 0 ? limit : undefined,
			}),
		);
	});
