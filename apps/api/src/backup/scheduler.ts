import { BackupOrchestrator } from "./orchestrator";
import type { BackupConfig, BackupTarget } from "./types";
import { listAllDatabases } from "../db/repo/databases";

export function startBackupScheduler(config: BackupConfig): void {
	if (!config.enabled) return;

	const orchestrator = new BackupOrchestrator(config);
	const interval = cronToMs(config.scheduleCron);

	console.log(`[Backup] Scheduler started (interval: ${interval}ms)`);

	setInterval(async () => {
		try {
			const targets = await getAllBackupTargets();
			for (const target of targets) {
				try {
					console.log(`[Backup] Backing up ${target.id}...`);
					await orchestrator.backup(target.id, async (id) => {
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
	}, interval);
}

function cronToMs(cron: string): number {
	const parts = cron.split(" ");
	if (parts.length !== 5) return 3600000;

	const [, hourPart] = parts;
	if (hourPart.includes("*/")) {
		const hours = parseInt(hourPart.replace("*/", ""), 10);
		return hours * 3600000;
	}

	return 3600000;
}

async function getAllBackupTargets(): Promise<BackupTarget[]> {
	const targets: BackupTarget[] = [getInternalTarget()];

	const databases = await listAllDatabases();
	for (const db of databases) {
		if (db.status !== "running" || !db.containerName) continue;
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
		});
	}

	return targets;
}

function getInternalTarget(): BackupTarget {
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
