import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { config } from "../../utils/config";
import { decryptValue, encryptValue } from "../../utils/crypto";
import { getDb } from "../db-provider";
import { smtpSettings } from "../schema";
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
