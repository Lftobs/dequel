import { eq, desc } from "drizzle-orm";
import { getDrizzle } from "../drizzle";
import { apiKeys } from "../schema";
import type { ApiKey, CreateApiKeyInput } from "../../types";
import { randomUUID } from "node:crypto";
import { now } from "./helpers";

const mapApiKey = (row: typeof apiKeys.$inferSelect): ApiKey => ({
  id: row.id,
  name: row.name,
  keyHash: row.keyHash,
  permissions: row.permissions,
  createdAt: row.createdAt,
  lastUsedAt: row.lastUsedAt,
});

export const createApiKey = async (input: CreateApiKeyInput): Promise<{ key: ApiKey; rawKey: string }> => {
  const id = randomUUID();
  const timestamp = now();
  const rawKey = `dql_${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawKey));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  const db = await getDrizzle();
  db.insert(apiKeys).values({
    id,
    name: input.name,
    keyHash,
    permissions: input.permissions ?? "deploy:read",
    createdAt: timestamp,
  }).run();
  return {
    key: mapApiKey(db.select().from(apiKeys).where(eq(apiKeys.id, id)).get()!),
    rawKey,
  };
};

export const listApiKeys = async (): Promise<ApiKey[]> => {
  const db = await getDrizzle();
  return db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt)).all().map(mapApiKey);
};

export const deleteApiKey = async (id: string): Promise<boolean> => {
  const db = await getDrizzle();
  return db.delete(apiKeys).where(eq(apiKeys.id, id)).run().changes > 0;
};

export const validateApiKey = async (rawKey: string): Promise<ApiKey | null> => {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawKey));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  const db = await getDrizzle();
  const row = db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).get();
  if (!row) return null;
  db.update(apiKeys).set({ lastUsedAt: now() }).where(eq(apiKeys.id, row.id)).run();
  return mapApiKey(row);
};
