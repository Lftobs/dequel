import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../db-provider";
import { sharedEnvVars, projectSharedEnvLinks } from "../schema";
import type { SharedEnvVar, CreateSharedEnvVarInput } from "../../types";
import { randomUUID } from "node:crypto";
import { config } from "../../utils/config";
import { encryptValue, decryptValue } from "../../utils/crypto";
import { now, getRowsAffected } from "./helpers";

const mapSharedEnvVar = (row: typeof sharedEnvVars.$inferSelect): SharedEnvVar => ({
  id: row.id,
  key: row.key,
  value: row.value ?? "",
  environment: row.environment,
  description: row.description ?? null,
  tags: Array.isArray(row.tags) ? row.tags : [],
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const createSharedEnvVar = async (input: CreateSharedEnvVarInput): Promise<SharedEnvVar> => {
  const id = randomUUID();
  const timestamp = now();
  const env = input.environment ?? "production";
  const encrypted = encryptValue(input.value, config.envEncryptionKey);
  const db = await getDb();
  await db.insert(sharedEnvVars).values({
    id,
    key: input.key,
    value: "",
    valueEncrypted: encrypted.encrypted,
    valueIv: encrypted.iv,
    valueTag: encrypted.tag,
    environment: env,
    description: input.description ?? null,
    tags: input.tags ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }).execute();
  const [row] = await db.select().from(sharedEnvVars).where(eq(sharedEnvVars.id, id)).execute();
  return mapSharedEnvVar(row);
};

export const listSharedEnvVars = async (environment?: string): Promise<SharedEnvVar[]> => {
  const db = await getDb();
  const cond = environment ? eq(sharedEnvVars.environment, environment) : undefined;
  const rows = await db.select().from(sharedEnvVars).where(cond).orderBy(asc(sharedEnvVars.key)).execute();
  return rows.map(mapSharedEnvVar);
};

export const getSharedEnvVarById = async (id: string): Promise<SharedEnvVar | null> => {
  const db = await getDb();
  const [row] = await db.select().from(sharedEnvVars).where(eq(sharedEnvVars.id, id)).execute();
  return row ? mapSharedEnvVar(row) : null;
};

export const getSharedEnvVarPlaintext = async (id: string): Promise<string | null> => {
  const db = await getDb();
  const [row] = await db.select({
    value: sharedEnvVars.value,
    valueEncrypted: sharedEnvVars.valueEncrypted,
    valueIv: sharedEnvVars.valueIv,
    valueTag: sharedEnvVars.valueTag,
  }).from(sharedEnvVars).where(eq(sharedEnvVars.id, id)).execute();
  if (!row) return null;
  if (row.valueEncrypted && row.valueIv && row.valueTag) {
    return decryptValue(row.valueEncrypted, row.valueIv, row.valueTag, config.envEncryptionKey);
  }
  return row.value ?? null;
};

export const updateSharedEnvVar = async (id: string, value: string): Promise<SharedEnvVar | null> => {
  const existing = await getSharedEnvVarById(id);
  if (!existing) return null;
  const encrypted = encryptValue(value, config.envEncryptionKey);
  const db = await getDb();
  await db.update(sharedEnvVars).set({
    value: "",
    valueEncrypted: encrypted.encrypted,
    valueIv: encrypted.iv,
    valueTag: encrypted.tag,
    updatedAt: now(),
  }).where(eq(sharedEnvVars.id, id)).execute();
  return getSharedEnvVarById(id);
};

export const deleteSharedEnvVar = async (id: string): Promise<boolean> => {
  const db = await getDb();
  return getRowsAffected(await db.delete(sharedEnvVars).where(eq(sharedEnvVars.id, id)).execute()) > 0;
};

export const linkSharedEnvVarsToProject = async (projectId: string, sharedEnvVarIds: string[]): Promise<void> => {
  const db = await getDb();
  const timestamp = now();
  for (const sharedEnvVarId of sharedEnvVarIds) {
    const existing = await db.select().from(projectSharedEnvLinks)
      .where(and(
        eq(projectSharedEnvLinks.projectId, projectId),
        eq(projectSharedEnvLinks.sharedEnvVarId, sharedEnvVarId),
      )).execute();
    if (existing.length === 0) {
      await db.insert(projectSharedEnvLinks).values({
        id: randomUUID(),
        projectId,
        sharedEnvVarId,
        createdAt: timestamp,
      }).execute();
    }
  }
};

export const unlinkSharedEnvVarFromProject = async (projectId: string, sharedEnvVarId: string): Promise<boolean> => {
  const db = await getDb();
  return getRowsAffected(await db.delete(projectSharedEnvLinks).where(
    and(eq(projectSharedEnvLinks.projectId, projectId), eq(projectSharedEnvLinks.sharedEnvVarId, sharedEnvVarId))
  ).execute()) > 0;
};

export const listLinkedSharedEnvVars = async (projectId: string): Promise<SharedEnvVar[]> => {
  const db = await getDb();
  const links = await db.select().from(projectSharedEnvLinks)
    .where(eq(projectSharedEnvLinks.projectId, projectId))
    .orderBy(asc(projectSharedEnvLinks.createdAt)).execute();
  if (links.length === 0) return [];
  const ids = links.map((l) => l.sharedEnvVarId);
  const rows = await db.select().from(sharedEnvVars).where(
    ids.length === 1 ? eq(sharedEnvVars.id, ids[0]) : undefined
  ).execute();
  const rowMap = new Map(rows.map((r) => [r.id, r]));
  return links.map((l) => rowMap.get(l.sharedEnvVarId)).filter(Boolean).map((r) => mapSharedEnvVar(r!));
};

export const listSharedEnvVarsForDeploy = async (projectId: string, environment?: string): Promise<{ key: string; value: string }[]> => {
  const linked = await listLinkedSharedEnvVars(projectId);
  const filtered = environment ? linked.filter((v) => v.environment === "production" || v.environment === environment) : linked;
  const result: { key: string; value: string }[] = [];
  for (const sv of filtered) {
    const plaintext = await getSharedEnvVarPlaintext(sv.id);
    if (plaintext !== null) {
      result.push({ key: sv.key, value: plaintext });
    }
  }
  return result;
};
