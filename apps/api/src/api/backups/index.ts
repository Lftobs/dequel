import { Elysia } from "elysia";
import { BackupOrchestrator } from "../../backup/orchestrator";
import type { BackupConfig, BackupTarget } from "../../backup/types";
import { deleteBackupRecord, getBackupRecord, listBackupRecords } from "../../db/repo/backups";
import { getDatabaseById } from "../../db/repo/databases";
import { getBackupStorageSettings } from "../../db/repo/settings";
import { created, fail, ok } from "../response";

async function getBackupConfig(targetId?: string): Promise<BackupConfig> {
	const storageSettings = await getBackupStorageSettings();
	let retentionCount = parseInt(process.env.BACKUP_RETENTION || "7", 10);
	let enabled = process.env.BACKUP_ENABLED === "true";
	let scheduleCron = process.env.BACKUP_SCHEDULE || "0 */6 * * *";

	if (targetId && targetId !== "internal") {
		const db = await getDatabaseById(targetId);
		if (db) {
			retentionCount = db.backupRetention ?? retentionCount;
			enabled = db.backupEnabled ?? enabled;
			scheduleCron = db.backupSchedule ?? scheduleCron;
		}
	}

	return {
		enabled,
		scheduleCron,
		retentionCount,
		storage: {
			type: storageSettings.type,
			path: storageSettings.path || "/data/backups",
			...(storageSettings.type === "s3"
				? {
						endpoint: storageSettings.s3Endpoint || "",
						accessKeyId: storageSettings.s3AccessKeyId || "",
						secretAccessKey: storageSettings.s3SecretAccessKey || "",
						bucket: storageSettings.s3Bucket || "",
						region: storageSettings.s3Region || "auto",
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
	.get("/config", async () => {
		return ok(await getBackupConfig());
	})
	.post("/", async ({ set }) => {
		try {
			const config = await getBackupConfig("internal");
			const orchestrator = new BackupOrchestrator(config);
			const job = await orchestrator.backup("internal", resolveTarget);
			return created(job);
		} catch (error) {
			set.status = 500;
			return fail(String(error));
		}
	})
	.post("/:id/trigger", async ({ params, set }) => {
		try {
			const config = await getBackupConfig(params.id);
			const orchestrator = new BackupOrchestrator(config);
			const job = await orchestrator.backup(params.id, resolveTarget);
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
			const record = await getBackupRecord(params.id);
			const config = await getBackupConfig(record?.targetId);
			const orchestrator = new BackupOrchestrator(config);
			await orchestrator.restore(params.id, resolveTarget);
			return ok({ restored: true });
		} catch (error) {
			set.status = 500;
			return fail(String(error));
		}
	});
