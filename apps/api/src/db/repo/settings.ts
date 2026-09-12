import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { config } from "../../utils/config";
import { decryptValue, encryptValue } from "../../utils/crypto";
import { getDb } from "../db-provider";
import { backupStorageSettings, smtpSettings } from "../schema";
import { now } from "./helpers";

export interface SmtpSettingsData {
	host: string;
	port: number;
	user: string;
	pass: string;
	fromAddress: string;
}

const mapRow = (row: typeof smtpSettings.$inferSelect): SmtpSettingsData => ({
	host: row.host,
	port: row.port,
	user: row.user,
	pass:
		row.passEncrypted && row.passIv && row.passTag
			? decryptValue(row.passEncrypted, row.passIv, row.passTag, config.envEncryptionKey)
			: "",
	fromAddress: row.fromAddress,
});

export const getSmtpSettings = async (): Promise<SmtpSettingsData | null> => {
	const db = await getDb();
	const [row] = await db.select().from(smtpSettings).orderBy(desc(smtpSettings.createdAt)).limit(1).execute();
	return row ? mapRow(row) : null;
};

export const upsertSmtpSettings = async (input: SmtpSettingsData): Promise<SmtpSettingsData> => {
	const db = await getDb();
	const encrypted = input.pass ? encryptValue(input.pass, config.envEncryptionKey) : null;

	return db.transaction(async (tx) => {
		const [existing] = await tx.select().from(smtpSettings).orderBy(desc(smtpSettings.createdAt)).limit(1).execute();
		const timestamp = now();

		if (existing) {
			await tx
				.update(smtpSettings)
				.set({
					host: input.host,
					port: input.port,
					user: input.user,
					passEncrypted: encrypted?.encrypted ?? existing.passEncrypted,
					passIv: encrypted?.iv ?? existing.passIv,
					passTag: encrypted?.tag ?? existing.passTag,
					fromAddress: input.fromAddress,
					updatedAt: timestamp,
				})
				.where(eq(smtpSettings.id, existing.id))
				.execute();
			const [updated] = await tx.select().from(smtpSettings).where(eq(smtpSettings.id, existing.id)).execute();
			return mapRow(updated);
		}

		const id = randomUUID();
		await tx
			.insert(smtpSettings)
			.values({
				id,
				host: input.host,
				port: input.port,
				user: input.user,
				passEncrypted: encrypted?.encrypted ?? null,
				passIv: encrypted?.iv ?? null,
				passTag: encrypted?.tag ?? null,
				fromAddress: input.fromAddress,
				createdAt: timestamp,
				updatedAt: timestamp,
			})
			.execute();
		const [inserted] = await tx.select().from(smtpSettings).where(eq(smtpSettings.id, id)).execute();
		return mapRow(inserted);
	});
};

export const getBackupStorageSettings = async (): Promise<import("../../types").BackupStorageSettingsData> => {
	const db = await getDb();
	const [row] = await db.select().from(backupStorageSettings).limit(1).execute();
	if (!row) {
		return {
			type: (process.env.BACKUP_STORAGE_TYPE as "local" | "s3") || "local",
			path: process.env.BACKUP_STORAGE_PATH || "/data/backups",
			s3Endpoint: process.env.BACKUP_S3_ENDPOINT || "",
			s3AccessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID || "",
			s3SecretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY || "",
			s3Bucket: process.env.BACKUP_S3_BUCKET || "",
			s3Region: process.env.BACKUP_S3_REGION || "auto",
		};
	}
	const secret =
		row.s3SecretAccessKeyEncrypted && row.s3SecretAccessKeyIv && row.s3SecretAccessKeyTag
			? decryptValue(
					row.s3SecretAccessKeyEncrypted,
					row.s3SecretAccessKeyIv,
					row.s3SecretAccessKeyTag,
					config.envEncryptionKey,
				)
			: "";
	return {
		type: (row.type as "local" | "s3") || "local",
		path: row.path || "/data/backups",
		s3Endpoint: row.s3Endpoint || "",
		s3AccessKeyId: row.s3AccessKeyId || "",
		s3SecretAccessKey: secret,
		s3Bucket: row.s3Bucket || "",
		s3Region: row.s3Region || "auto",
	};
};

export const upsertBackupStorageSettings = async (
	input: import("../../types").BackupStorageSettingsData,
): Promise<import("../../types").BackupStorageSettingsData> => {
	const db = await getDb();
	const encrypted = input.s3SecretAccessKey ? encryptValue(input.s3SecretAccessKey, config.envEncryptionKey) : null;
	const timestamp = now();

	return db.transaction(async (tx) => {
		const [existing] = await tx.select().from(backupStorageSettings).limit(1).execute();
		if (existing) {
			await tx
				.update(backupStorageSettings)
				.set({
					type: input.type,
					path: input.path ?? "/data/backups",
					s3Endpoint: input.s3Endpoint ?? "",
					s3AccessKeyId: input.s3AccessKeyId ?? "",
					s3SecretAccessKeyEncrypted: encrypted?.encrypted ?? existing.s3SecretAccessKeyEncrypted,
					s3SecretAccessKeyIv: encrypted?.iv ?? existing.s3SecretAccessKeyIv,
					s3SecretAccessKeyTag: encrypted?.tag ?? existing.s3SecretAccessKeyTag,
					s3Bucket: input.s3Bucket ?? "",
					s3Region: input.s3Region ?? "auto",
					updatedAt: timestamp,
				})
				.where(eq(backupStorageSettings.id, existing.id))
				.execute();
		} else {
			await tx
				.insert(backupStorageSettings)
				.values({
					id: randomUUID(),
					type: input.type,
					path: input.path ?? "/data/backups",
					s3Endpoint: input.s3Endpoint ?? "",
					s3AccessKeyId: input.s3AccessKeyId ?? "",
					s3SecretAccessKeyEncrypted: encrypted?.encrypted ?? null,
					s3SecretAccessKeyIv: encrypted?.iv ?? null,
					s3SecretAccessKeyTag: encrypted?.tag ?? null,
					s3Bucket: input.s3Bucket ?? "",
					s3Region: input.s3Region ?? "auto",
					updatedAt: timestamp,
				})
				.execute();
		}
		return getBackupStorageSettings();
	});
};
