import { listAllDatabases } from "../db/repo/databases";
import { getBackupStorageSettings } from "../db/repo/settings";
import { BackupOrchestrator } from "./orchestrator";
import { S3_BACKUP_PREFIX } from "./types";
import type { BackupTarget, StorageConfig } from "./types";

const lastFiredMinute = new Map<string, number>();

const DEFAULT_SCHEDULE = "0 */6 * * *";
const DEFAULT_RETENTION = 7;

export function startBackupScheduler(): void {
	console.log("[Backup] Scheduler started (checking every 60s)");

	setInterval(async () => {
		try {
			const settings = await getBackupStorageSettings();
			const storage = toStorageConfig(settings);
			const orchestrator = new BackupOrchestrator(storage);
			const targets = await getAllBackupTargets(settings.systemBackupSchedule, settings.systemBackupRetention);
			const now = new Date();

			for (const target of targets) {
				try {
					const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
					const lastKey = lastFiredMinute.get(target.id);

					if (lastKey === minuteKey) continue;

					if (!matchesCron(target.scheduleCron, now)) continue;

					console.log(`[Backup] Backing up ${target.id} (${target.engine})...`);
					lastFiredMinute.set(target.id, minuteKey);

					await orchestrator.backup(target.id, target.retentionCount, async (id) => {
						if (id === "internal") return getInternalTarget();
						return getManagedTarget(id);
					});

					console.log(`[Backup] Completed ${target.id}`);
				} catch (error) {
					console.error(`[Backup] Failed for ${target.id}:`, error);
				}
			}
		} catch (error) {
			console.error("[Backup] Scheduler error:", error);
		}
	}, 60_000);
}

function toStorageConfig(settings: {
	type: string;
	path?: string;
	s3Endpoint?: string;
	s3AccessKeyId?: string;
	s3SecretAccessKey?: string;
	s3Bucket?: string;
	s3Region?: string;
}): StorageConfig {
	if (settings.type === "s3") {
		return {
			type: "s3",
			endpoint: settings.s3Endpoint || "",
			accessKeyId: settings.s3AccessKeyId || "",
			secretAccessKey: settings.s3SecretAccessKey || "",
			bucket: settings.s3Bucket || "",
			region: settings.s3Region || "auto",
			prefix: S3_BACKUP_PREFIX,
		};
	}
	return { type: "local", path: settings.path || "/data/backups" };
}

function matchesCron(cron: string, date: Date): boolean {
	const parts = cron.trim().split(/\s+/);
	if (parts.length !== 5) return false;

	const [minExpr, hourExpr, dayExpr, monthExpr, dowExpr] = parts;

	if (!matchField(minExpr, date.getMinutes())) return false;
	if (!matchField(hourExpr, date.getHours())) return false;
	if (!matchField(dayExpr, date.getDate())) return false;
	if (!matchField(monthExpr, date.getMonth() + 1)) return false;
	if (!matchField(dowExpr, date.getDay())) return false;

	return true;
}

function matchField(expr: string, value: number): boolean {
	if (expr === "*") return true;

	for (const part of expr.split(",")) {
		if (part.includes("-")) {
			const [start, end] = part.split("-").map(Number);
			if (value >= start && value <= end) return true;
		} else if (part.includes("/")) {
			const [range, step] = part.split("/");
			const stepNum = parseInt(step, 10);
			if (range === "*") {
				if (value % stepNum === 0) return true;
			} else {
				const start = parseInt(range, 10);
				if (value >= start && value % stepNum === 0) return true;
			}
		} else {
			if (parseInt(part, 10) === value) return true;
		}
	}

	return false;
}

interface SchedulableTarget extends BackupTarget {
	scheduleCron: string;
	retentionCount: number;
}

async function getAllBackupTargets(systemSchedule: string, systemRetention: number): Promise<SchedulableTarget[]> {
	const targets: SchedulableTarget[] = [
		{
			...getInternalTarget(),
			scheduleCron: systemSchedule || DEFAULT_SCHEDULE,
			retentionCount: systemRetention ?? DEFAULT_RETENTION,
		},
	];

	const databases = await listAllDatabases();
	for (const db of databases) {
		if (db.status !== "running" || !db.containerName) continue;
		if (!db.backupEnabled) continue;

		targets.push({
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
			scheduleCron: db.backupSchedule || DEFAULT_SCHEDULE,
			retentionCount: db.backupRetention ?? DEFAULT_RETENTION,
		});
	}

	return targets;
}

function getInternalTarget(): BackupTarget {
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

async function getManagedTarget(id: string): Promise<BackupTarget> {
	const databases = await listAllDatabases();
	const db = databases.find((d) => d.id === id);
	if (!db) throw new Error(`Database ${id} not found`);
	if (!db.containerName) throw new Error(`Database ${id} has no container`);

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
