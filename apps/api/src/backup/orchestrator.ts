import { randomUUID } from "node:crypto";
import { createGzip, createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { getAdapter } from "./adapters";
import { createStorage } from "./storage/index";
import type { BackupConfig, BackupJob, BackupTarget } from "./types";
import type { BackupStorage } from "./storage";
import type { BackupContext } from "./adapter";
import { getServerById } from "../db/repo";
import {
	createBackupRecord,
	getBackupRecord,
	updateBackupRecord,
	deleteBackupRecord,
	listCompletedBackupsForTarget,
} from "../db/repo/backups";

async function buildContext(target: BackupTarget): Promise<BackupContext> {
	const server = target.serverId ? await getServerById(target.serverId) : null;
	return { target, server };
}

export class BackupOrchestrator {
	private storage: BackupStorage;
	private config: BackupConfig;

	constructor(config: BackupConfig) {
		this.config = config;
		this.storage = createStorage(config.storage);
	}

	async backup(targetId: string, resolveTarget: (id: string) => Promise<BackupTarget>): Promise<BackupJob> {
		const target = await resolveTarget(targetId);
		const ctx = await buildContext(target);
		const adapter = getAdapter(target.engine);
		const job = await this.createJob(target);

		try {
			await this.updateJob(job.id, { status: "dumping" });
			const dump = await adapter.dump(ctx);

			await this.updateJob(job.id, { status: "compressing" });
			const compressed = dump.pipe(createGzip());

			await this.updateJob(job.id, { status: "uploading" });
			const filename = `${target.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.sql.gz`;
			const storagePath = await this.storage.upload(filename, compressed);

			const completed = await this.updateJob(job.id, {
				status: "completed",
				filename,
				storagePath,
				completedAt: new Date(),
			});

			await this.enforceRetention(targetId);

			return completed;
		} catch (error) {
			await this.updateJob(job.id, { status: "failed", error: String(error) });
			throw error;
		}
	}

	async restore(backupId: string, resolveTarget: (id: string) => Promise<BackupTarget>): Promise<void> {
		const job = await this.getJob(backupId);
		const target = await resolveTarget(job.targetId);
		const ctx = await buildContext(target);
		const adapter = getAdapter(target.engine);

		const compressed = await this.storage.download(job.storagePath!);
		const dump = compressed.pipe(createGunzip());
		await adapter.restore(ctx, dump);
	}

	private async enforceRetention(targetId: string): Promise<void> {
		const completed = await listCompletedBackupsForTarget(targetId);
		const toDelete = completed.slice(this.config.retentionCount);

		for (const job of toDelete) {
			if (job.storagePath) {
				await this.storage.delete(job.storagePath);
			}
			await deleteBackupRecord(job.id);
		}
	}

	private async createJob(target: BackupTarget): Promise<BackupJob> {
		const record = await createBackupRecord({
			id: randomUUID(),
			targetId: target.id,
			targetType: target.type,
			engine: target.engine,
			filename: null,
			storageType: this.config.storage.type,
			storagePath: null,
			sizeBytes: null,
			status: "pending",
			error: null,
		});

		return record as BackupJob;
	}

	private async updateJob(id: string, updates: Partial<BackupJob>): Promise<BackupJob> {
		const updated = await updateBackupRecord(id, updates);
		if (!updated) throw new Error(`Backup job ${id} not found`);
		return updated as BackupJob;
	}

	private async getJob(id: string): Promise<BackupJob> {
		const record = await getBackupRecord(id);
		if (!record) throw new Error(`Backup job ${id} not found`);
		return record as BackupJob;
	}
}
