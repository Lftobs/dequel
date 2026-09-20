import { Elysia } from "elysia";
import { BackupOrchestrator } from "../../backup/orchestrator";
import { S3_BACKUP_PREFIX } from "../../backup/types";
import type { BackupTarget, StorageConfig } from "../../backup/types";
import { deleteBackupRecord, getBackupRecord, listBackupRecords } from "../../db/repo/backups";
import { getDatabaseById } from "../../db/repo/databases";
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
		try {
			const storage = await loadStorageConfig();
			const orchestrator = new BackupOrchestrator(storage);
			await orchestrator.restore(params.id, resolveTarget);
			return ok({ restored: true });
		} catch (error) {
			set.status = 500;
			return fail(String(error));
		}
	});
