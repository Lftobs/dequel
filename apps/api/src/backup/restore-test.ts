import { randomUUID } from "node:crypto";
import { createGunzip } from "node:zlib";
import { resolveDbImage } from "../databases/manager";
import { getDatabaseById, getServerById } from "../db/repo";
import { getBackupRecord } from "../db/repo/backups";
import { createRestoreTestRecord, updateRestoreTestRecord } from "../db/repo/restore-tests";
import { getBackupStorageSettings } from "../db/repo/settings";
import type { Server } from "../types";
import { dockerRun, ensureContainerRemoved } from "../utils/docker-run";
import type { BackupContext } from "./adapter";
import { getAdapter } from "./adapters";
import { createStorage } from "./storage/index";
import type { BackupTarget, DatabaseType, StorageConfig } from "./types";
import { S3_BACKUP_PREFIX } from "./types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const scratchEnv = (engine: DatabaseType, username: string, password: string, databaseName: string): string[] => {
	if (engine === "postgresql") {
		return [`POSTGRES_USER=${username}`, `POSTGRES_PASSWORD=${password}`, `POSTGRES_DB=${databaseName}`];
	}
	if (engine === "mysql") {
		return [
			`MYSQL_ROOT_PASSWORD=${password}`,
			`MYSQL_DATABASE=${databaseName}`,
			`MYSQL_USER=${username}`,
			`MYSQL_PASSWORD=${password}`,
		];
	}
	if (engine === "mongodb") {
		return [
			`MONGO_INITDB_ROOT_USERNAME=${username}`,
			`MONGO_INITDB_ROOT_PASSWORD=${password}`,
			`MONGO_INITDB_DATABASE=${databaseName}`,
		];
	}
	return [];
};

const scratchCommand = (engine: DatabaseType, password: string): string[] => {
	if (engine === "redis") return ["redis-server", "--requirepass", password];
	return [];
};

export interface RestoreTestOptions {
	backupId: string;
	serverId?: string | null;
}

export const runRestoreTest = async (options: RestoreTestOptions) => {
	const job = await getBackupRecord(options.backupId);
	if (!job) throw new Error("Backup not found");
	if (job.status !== "completed" || !job.storagePath) {
		throw new Error("Backup has not completed successfully");
	}

	const engine = job.engine as DatabaseType;
	const adapter = getAdapter(engine);

	let version: string | null = null;
	let databaseName = "dequel";
	if (job.targetId !== "internal") {
		const db = await getDatabaseById(job.targetId);
		if (!db) throw new Error(`Database ${job.targetId} not found`);
		version = db.version;
		databaseName = db.databaseName;
	}

	let server: Server | null = null;
	let serverId: string | null = null;
	if (options.serverId) {
		server = await getServerById(options.serverId);
		if (!server) throw new Error("Restore-test server not found");
		serverId = server.id;
	}

	const test = await createRestoreTestRecord({
		id: randomUUID(),
		backupId: job.id,
		targetId: job.targetId,
		serverId,
	});

	const scratchName = `dequel-restore-test-${test.id.slice(0, 8)}`;
	const username = "dequel";
	const password = randomUUID().replace(/-/g, "");
	const target: BackupTarget = {
		id: `restore-test-${test.id}`,
		type: "managed",
		engine,
		containerName: scratchName,
		databaseName,
		serverId,
		credentials: { username, password },
	};
	const ctx: BackupContext = { target, server };

	try {
		const image = resolveDbImage(engine, version);
		const envArgs = scratchEnv(engine, username, password, databaseName).flatMap((e) => ["-e", e]);
		await dockerRun(
			"docker",
			["run", "-d", "--name", scratchName, ...envArgs, image, ...scratchCommand(engine, password)],
			server,
		);

		const deadline = Date.now() + 90_000;
		let ready = false;
		while (Date.now() < deadline) {
			if (await adapter.ping(ctx)) {
				ready = true;
				break;
			}
			await sleep(2_000);
		}
		if (!ready) throw new Error(`Scratch ${engine} container did not become ready`);

		const storage = createStorage(await loadStorageConfig());
		const compressed = await storage.download(job.storagePath);
		await adapter.restore(ctx, compressed.pipe(createGunzip()));

		if (!(await adapter.ping(ctx))) throw new Error("Restored container failed health check");

		return updateRestoreTestRecord(test.id, { status: "passed", completedAt: new Date() });
	} catch (error) {
		return updateRestoreTestRecord(test.id, {
			status: "failed",
			error: String(error),
			completedAt: new Date(),
		});
	} finally {
		await ensureContainerRemoved(scratchName, server).catch(() => {});
	}
};
