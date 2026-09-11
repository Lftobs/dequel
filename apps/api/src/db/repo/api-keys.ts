import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { ApiKey, CreateApiKeyInput } from "../../types";
import { getDb } from "../db-provider";
import { apiKeys } from "../schema";
import { getRowsAffected, now } from "./helpers";

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
	const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	const db = await getDb();
	await db
		.insert(apiKeys)
		.values({
			id,
			name: input.name,
			keyHash,
			permissions: input.permissions ?? "deploy:read",
			createdAt: timestamp,
		})
		.execute();
	const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).execute();
	return {
		key: mapApiKey(row),
		rawKey,
	};
};

export const listApiKeys = async (): Promise<ApiKey[]> => {
	const db = await getDb();
	const rows = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt)).execute();
	return rows.map(mapApiKey);
};

export const deleteApiKey = async (id: string): Promise<boolean> => {
	const db = await getDb();
	return getRowsAffected(await db.delete(apiKeys).where(eq(apiKeys.id, id)).execute()) > 0;
};

export const validateApiKey = async (rawKey: string): Promise<ApiKey | null> => {
	const encoder = new TextEncoder();
	const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawKey));
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	const db = await getDb();
	const [row] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).execute();
	if (!row) return null;
	await db.update(apiKeys).set({ lastUsedAt: now() }).where(eq(apiKeys.id, row.id)).execute();
	return mapApiKey(row);
};
