import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { Registry } from "../../types";
import { config } from "../../utils/config";
import { decryptValue, encryptValue } from "../../utils/crypto";
import { getDb } from "../db-provider";
import { registries } from "../schema";
import { getRowsAffected, now } from "./helpers";

const mapRegistry = (row: typeof registries.$inferSelect): Registry => ({
	id: row.id,
	name: row.name,
	serverId: row.serverId ?? null,
	url: row.url,
	username: row.username,
	hasPassword: Boolean(row.passwordEncrypted && row.passwordIv && row.passwordTag),
	createdAt: row.createdAt.toISOString(),
	updatedAt: row.updatedAt.toISOString(),
});

export const createRegistry = async (input: {
	name: string;
	serverId?: string | null;
	url: string;
	username: string;
	password: string;
}): Promise<Registry> => {
	const id = randomUUID();
	const timestamp = now();
	const enc = encryptValue(input.password, config.envEncryptionKey);
	const db = await getDb();
	await db
		.insert(registries)
		.values({
			id,
			name: input.name,
			serverId: input.serverId ?? null,
			url: input.url,
			username: input.username,
			passwordEncrypted: enc.encrypted,
			passwordIv: enc.iv,
			passwordTag: enc.tag,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		.execute();
	const [row] = await db.select().from(registries).where(eq(registries.id, id)).execute();
	return mapRegistry(row);
};

export const listRegistries = async (): Promise<Registry[]> => {
	const db = await getDb();
	const rows = await db.select().from(registries).orderBy(desc(registries.createdAt)).execute();
	return rows.map(mapRegistry);
};

export const getRegistryById = async (id: string): Promise<Registry | null> => {
	const db = await getDb();
	const [row] = await db.select().from(registries).where(eq(registries.id, id)).execute();
	return row ? mapRegistry(row) : null;
};

export const getRegistryCredentials = async (
	id: string,
): Promise<{ url: string; username: string; password: string } | null> => {
	const db = await getDb();
	const [row] = await db.select().from(registries).where(eq(registries.id, id)).execute();
	if (!row?.passwordEncrypted || !row.passwordIv || !row.passwordTag) return null;
	try {
		return {
			url: row.url,
			username: row.username,
			password: decryptValue(row.passwordEncrypted, row.passwordIv, row.passwordTag, config.envEncryptionKey),
		};
	} catch {
		return null;
	}
};

export const findRegistryForImage = async (imageRef: string): Promise<string | null> => {
	const registriesList = await listRegistries();
	const host = imageRef.split("/")[0]?.toLowerCase();
	const match = registriesList.find((r) => {
		const url = r.url
			.replace(/^https?:\/\//, "")
			.replace(/\/$/, "")
			.toLowerCase();
		return url === host || host.endsWith(`.${url}`) || url.endsWith(`.${host}`);
	});
	return match?.id ?? null;
};

export const updateRegistry = async (
	id: string,
	patch: { name?: string; serverId?: string | null; url?: string; username?: string; password?: string },
): Promise<Registry | null> => {
	const existing = await getRegistryById(id);
	if (!existing) return null;
	const updates: Record<string, unknown> = { updatedAt: now() };
	if (patch.name !== undefined) updates.name = patch.name;
	if (patch.serverId !== undefined) updates.serverId = patch.serverId;
	if (patch.url !== undefined) updates.url = patch.url;
	if (patch.username !== undefined) updates.username = patch.username;
	if (patch.password) {
		const enc = encryptValue(patch.password, config.envEncryptionKey);
		updates.passwordEncrypted = enc.encrypted;
		updates.passwordIv = enc.iv;
		updates.passwordTag = enc.tag;
	}
	const db = await getDb();
	await db.update(registries).set(updates).where(eq(registries.id, id)).execute();
	return getRegistryById(id);
};

export const deleteRegistry = async (id: string): Promise<boolean> => {
	const db = await getDb();
	return getRowsAffected(await db.delete(registries).where(eq(registries.id, id)).execute()) > 0;
};
