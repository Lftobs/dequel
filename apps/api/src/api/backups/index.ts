import { Elysia } from "elysia";
import { BackupOrchestrator } from "../../backup/orchestrator";
import type { BackupConfig, BackupTarget } from "../../backup/types";
import { listBackupRecords, getBackupRecord, deleteBackupRecord } from "../../db/repo/backups";
import { listAllDatabases, getDatabaseById } from "../../db/repo/databases";
import { created, fail, ok } from "../response";

function getBackupConfig(): BackupConfig {
	return {
		enabled: process.env.BACKUP_ENABLED === "true",
		scheduleCron: process.env.BACKUP_SCHEDULE || "0 */6 * * *",
		retentionCount: parseInt(process.env.BACKUP_RETENTION || "7", 10),
		storage: {
			type: (process.env.BACKUP_STORAGE_TYPE as "local" | "s3") || "local",
			path: process.env.BACKUP_STORAGE_PATH || "/data/backups",
			...(process.env.BACKUP_STORAGE_TYPE === "s3"
				? {
						endpoint: process.env.BACKUP_S3_ENDPOINT || "",
						accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID || "",
						secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY || "",
						bucket: process.env.BACKUP_S3_BUCKET || "",
						region: process.env.BACKUP_S3_REGION || "auto",
					}
				: {}),
		},
	};
}

async function resolveTarget(targetId: string): Promise<BackupTarget> {
	if (targetId === "internal") {
		return {
			id: "internal",
			type: "internal",
			engine: "postgresql",
			containerName: "postgres",
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
	.post("/", async ({ set }) => {
		try {
			const config = getBackupConfig();
			const orchestrator = new BackupOrchestrator(config);
			const job = await orchestrator.backup("internal", resolveTarget);
			return created(job);
		} catch (error) {
			set.status = 500;
			return fail(String(error));
		}
	})
	.post("/:targetId", async ({ params, set }) => {
		try {
			const config = getBackupConfig();
			const orchestrator = new BackupOrchestrator(config);
			const job = await orchestrator.backup(params.targetId, resolveTarget);
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
			const config = getBackupConfig();
			const orchestrator = new BackupOrchestrator(config);
			await orchestrator.restore(params.id, resolveTarget);
			return ok({ restored: true });
		} catch (error) {
			set.status = 500;
			return fail(String(error));
		}
	})
	.get("/config", () => {
		return ok(getBackupConfig());
	});
