import { and, eq, isNotNull } from "drizzle-orm";
import { config } from "../utils/config";
import { DEFAULT_ENV_ENCRYPTION_KEY, decryptValue, encryptValue } from "../utils/crypto";
import { getDb } from "./db-provider";
import {
	backupStorageSettings,
	environmentVariables,
	githubSessions,
	llmProviderKeys,
	projects,
	servers,
	sharedEnvVars,
	smtpSettings,
	sshKeys,
} from "./schema";

type Triple = { encrypted: string; iv: string; tag: string };
type StoredTriple = { enc: string | null; iv: string | null; tag: string | null };
type StoreResult = { migrated: number; unknown: number };
type Store = { name: string; run: (activeKey: string) => Promise<StoreResult> };

const processRows = async <R>(
	rows: R[],
	getTriple: (row: R) => StoredTriple,
	write: (row: R, next: Triple) => Promise<unknown>,
	activeKey: string,
): Promise<StoreResult> => {
	let migrated = 0;
	let unknown = 0;
	for (const row of rows) {
		const { enc, iv, tag } = getTriple(row);
		if (!enc || !iv || !tag) continue;
		try {
			decryptValue(enc, iv, tag, activeKey);
			continue;
		} catch {}
		let plain: string;
		try {
			plain = decryptValue(enc, iv, tag, DEFAULT_ENV_ENCRYPTION_KEY);
		} catch {
			unknown += 1;
			continue;
		}
		await write(row, encryptValue(plain, activeKey));
		migrated += 1;
	}
	return { migrated, unknown };
};

const STORES: Store[] = [
	{
		name: "environment_variables",
		run: async (activeKey) => {
			const db = await getDb();
			const rows = await db
				.select()
				.from(environmentVariables)
				.where(
					and(
						isNotNull(environmentVariables.valueEncrypted),
						isNotNull(environmentVariables.valueIv),
						isNotNull(environmentVariables.valueTag),
					),
				);
			return processRows(
				rows,
				(r) => ({ enc: r.valueEncrypted, iv: r.valueIv, tag: r.valueTag }),
				(r, next) =>
					db
						.update(environmentVariables)
						.set({ valueEncrypted: next.encrypted, valueIv: next.iv, valueTag: next.tag })
						.where(eq(environmentVariables.id, r.id))
						.execute(),
				activeKey,
			);
		},
	},
	{
		name: "shared_env_vars",
		run: async (activeKey) => {
			const db = await getDb();
			const rows = await db
				.select()
				.from(sharedEnvVars)
				.where(
					and(
						isNotNull(sharedEnvVars.valueEncrypted),
						isNotNull(sharedEnvVars.valueIv),
						isNotNull(sharedEnvVars.valueTag),
					),
				);
			return processRows(
				rows,
				(r) => ({ enc: r.valueEncrypted, iv: r.valueIv, tag: r.valueTag }),
				(r, next) =>
					db
						.update(sharedEnvVars)
						.set({ valueEncrypted: next.encrypted, valueIv: next.iv, valueTag: next.tag })
						.where(eq(sharedEnvVars.id, r.id))
						.execute(),
				activeKey,
			);
		},
	},
	{
		name: "ssh_keys",
		run: async (activeKey) => {
			const db = await getDb();
			const rows = await db
				.select()
				.from(sshKeys)
				.where(
					and(
						isNotNull(sshKeys.privateKeyEncrypted),
						isNotNull(sshKeys.privateKeyIv),
						isNotNull(sshKeys.privateKeyTag),
					),
				);
			return processRows(
				rows,
				(r) => ({ enc: r.privateKeyEncrypted, iv: r.privateKeyIv, tag: r.privateKeyTag }),
				(r, next) =>
					db
						.update(sshKeys)
						.set({
							privateKeyEncrypted: next.encrypted,
							privateKeyIv: next.iv,
							privateKeyTag: next.tag,
						})
						.where(eq(sshKeys.id, r.id))
						.execute(),
				activeKey,
			);
		},
	},
	{
		name: "servers",
		run: async (activeKey) => {
			const db = await getDb();
			const rows = await db
				.select()
				.from(servers)
				.where(and(isNotNull(servers.sshKey), isNotNull(servers.sshKeyIv), isNotNull(servers.sshKeyTag)));
			return processRows(
				rows,
				(r) => ({ enc: r.sshKey, iv: r.sshKeyIv, tag: r.sshKeyTag }),
				(r, next) =>
					db
						.update(servers)
						.set({ sshKey: next.encrypted, sshKeyIv: next.iv, sshKeyTag: next.tag })
						.where(eq(servers.id, r.id))
						.execute(),
				activeKey,
			);
		},
	},
	{
		name: "smtp_settings",
		run: async (activeKey) => {
			const db = await getDb();
			const rows = await db
				.select()
				.from(smtpSettings)
				.where(
					and(isNotNull(smtpSettings.passEncrypted), isNotNull(smtpSettings.passIv), isNotNull(smtpSettings.passTag)),
				);
			return processRows(
				rows,
				(r) => ({ enc: r.passEncrypted, iv: r.passIv, tag: r.passTag }),
				(r, next) =>
					db
						.update(smtpSettings)
						.set({ passEncrypted: next.encrypted, passIv: next.iv, passTag: next.tag })
						.where(eq(smtpSettings.id, r.id))
						.execute(),
				activeKey,
			);
		},
	},
	{
		name: "backup_storage_settings",
		run: async (activeKey) => {
			const db = await getDb();
			const rows = await db
				.select()
				.from(backupStorageSettings)
				.where(
					and(
						isNotNull(backupStorageSettings.s3SecretAccessKeyEncrypted),
						isNotNull(backupStorageSettings.s3SecretAccessKeyIv),
						isNotNull(backupStorageSettings.s3SecretAccessKeyTag),
					),
				);
			return processRows(
				rows,
				(r) => ({
					enc: r.s3SecretAccessKeyEncrypted,
					iv: r.s3SecretAccessKeyIv,
					tag: r.s3SecretAccessKeyTag,
				}),
				(r, next) =>
					db
						.update(backupStorageSettings)
						.set({
							s3SecretAccessKeyEncrypted: next.encrypted,
							s3SecretAccessKeyIv: next.iv,
							s3SecretAccessKeyTag: next.tag,
						})
						.where(eq(backupStorageSettings.id, r.id))
						.execute(),
				activeKey,
			);
		},
	},
	{
		name: "llm_provider_keys",
		run: async (activeKey) => {
			const db = await getDb();
			const rows = await db
				.select()
				.from(llmProviderKeys)
				.where(
					and(
						isNotNull(llmProviderKeys.keyEncrypted),
						isNotNull(llmProviderKeys.keyIv),
						isNotNull(llmProviderKeys.keyTag),
					),
				);
			return processRows(
				rows,
				(r) => ({ enc: r.keyEncrypted, iv: r.keyIv, tag: r.keyTag }),
				(r, next) =>
					db
						.update(llmProviderKeys)
						.set({ keyEncrypted: next.encrypted, keyIv: next.iv, keyTag: next.tag })
						.where(eq(llmProviderKeys.provider, r.provider))
						.execute(),
				activeKey,
			);
		},
	},
	{
		name: "github_sessions",
		run: async (activeKey) => {
			const db = await getDb();
			const rows = await db
				.select()
				.from(githubSessions)
				.where(
					and(
						isNotNull(githubSessions.accessTokenEncrypted),
						isNotNull(githubSessions.accessTokenIv),
						isNotNull(githubSessions.accessTokenTag),
					),
				);
			return processRows(
				rows,
				(r) => ({ enc: r.accessTokenEncrypted, iv: r.accessTokenIv, tag: r.accessTokenTag }),
				(r, next) =>
					db
						.update(githubSessions)
						.set({
							accessTokenEncrypted: next.encrypted,
							accessTokenIv: next.iv,
							accessTokenTag: next.tag,
						})
						.where(eq(githubSessions.id, r.id))
						.execute(),
				activeKey,
			);
		},
	},
	{
		name: "projects",
		run: async (activeKey) => {
			const db = await getDb();
			const rows = await db
				.select()
				.from(projects)
				.where(
					and(
						isNotNull(projects.githubTokenEncrypted),
						isNotNull(projects.githubTokenIv),
						isNotNull(projects.githubTokenTag),
					),
				);
			return processRows(
				rows,
				(r) => ({ enc: r.githubTokenEncrypted, iv: r.githubTokenIv, tag: r.githubTokenTag }),
				(r, next) =>
					db
						.update(projects)
						.set({
							githubTokenEncrypted: next.encrypted,
							githubTokenIv: next.iv,
							githubTokenTag: next.tag,
						})
						.where(eq(projects.id, r.id))
						.execute(),
				activeKey,
			);
		},
	},
];

export const migrateEncryptionKeys = async (activeKey: string = config.envEncryptionKey): Promise<void> => {
	if (activeKey === DEFAULT_ENV_ENCRYPTION_KEY) return;
	let migratedTotal = 0;
	let unknownTotal = 0;
	for (const store of STORES) {
		try {
			const res = await store.run(activeKey);
			migratedTotal += res.migrated;
			unknownTotal += res.unknown;
			if (res.migrated > 0) console.log(`[EncryptionMigration] ${store.name}: re-encrypted ${res.migrated} row(s)`);
			if (res.unknown > 0)
				console.warn(`[EncryptionMigration] ${store.name}: ${res.unknown} row(s) use an unknown key, left untouched`);
		} catch (err) {
			console.error(`[EncryptionMigration] ${store.name}: failed —`, err);
		}
	}
	if (migratedTotal > 0) console.log(`[EncryptionMigration] done — ${migratedTotal} row(s) now use the configured key`);
	else console.log("[EncryptionMigration] already using the configured key");
	if (unknownTotal > 0)
		console.warn(`[EncryptionMigration] ${unknownTotal} row(s) total use an unknown key and were left untouched`);
};
