import { eq, desc } from "drizzle-orm";
import { getDrizzle } from "../drizzle";
import { smtpSettings } from "../schema";
import { encryptValue, decryptValue } from "../../utils/crypto";
import { config } from "../../utils/config";
import { randomUUID } from "node:crypto";
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
  pass: row.passEncrypted && row.passIv && row.passTag
    ? decryptValue(row.passEncrypted, row.passIv, row.passTag, config.envEncryptionKey)
    : "",
  fromAddress: row.fromAddress,
});

export const getSmtpSettings = async (): Promise<SmtpSettingsData | null> => {
  const db = await getDrizzle();
  const row = db.select().from(smtpSettings).orderBy(desc(smtpSettings.createdAt)).limit(1).get();
  return row ? mapRow(row) : null;
};

export const upsertSmtpSettings = async (input: SmtpSettingsData): Promise<SmtpSettingsData> => {
  const db = await getDrizzle();
  const encrypted = input.pass
    ? encryptValue(input.pass, config.envEncryptionKey)
    : null;

  return db.transaction((tx) => {
    const existing = tx.select().from(smtpSettings).orderBy(desc(smtpSettings.createdAt)).limit(1).get();
    const timestamp = now();

    if (existing) {
      tx.update(smtpSettings).set({
        host: input.host,
        port: input.port,
        user: input.user,
        passEncrypted: encrypted?.encrypted ?? existing.passEncrypted,
        passIv: encrypted?.iv ?? existing.passIv,
        passTag: encrypted?.tag ?? existing.passTag,
        fromAddress: input.fromAddress,
        updatedAt: timestamp,
      }).where(eq(smtpSettings.id, existing.id)).run();
      const updated = tx.select().from(smtpSettings).where(eq(smtpSettings.id, existing.id)).get()!;
      return mapRow(updated);
    }

    const id = randomUUID();
    tx.insert(smtpSettings).values({
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
    }).run();
    const inserted = tx.select().from(smtpSettings).where(eq(smtpSettings.id, id)).get()!;
    return mapRow(inserted);
  });
};
