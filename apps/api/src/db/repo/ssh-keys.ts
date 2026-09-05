import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { CreateSshKeyInput, SshKey } from "../../types";
import { config } from "../../utils/config";
import { decryptValue, encryptValue } from "../../utils/crypto";
import { getDb } from "../db-provider";
import { sshKeys } from "../schema";
import { getRowsAffected, now } from "./helpers";

const computeFingerprint = (privateKey: string): string => {
	return createHash("sha256").update(privateKey).digest("hex").slice(0, 32);
};

const mapSshKey = (row: typeof sshKeys.$inferSelect): SshKey => ({
	id: row.id,
	name: row.name,
	fingerprint: row.fingerprint,
	publicKey: row.publicKey ?? null,
	tags: Array.isArray(row.tags) ? row.tags : [],
	createdAt: row.createdAt,
	updatedAt: row.updatedAt,
});

export const createSshKey = async (input: CreateSshKeyInput): Promise<SshKey> => {
	const id = randomUUID();
	const timestamp = now();
	const fingerprint = computeFingerprint(input.privateKey);
	const encrypted = encryptValue(input.privateKey, config.envEncryptionKey);
	const db = await getDb();
	await db
		.insert(sshKeys)
		.values({
			id,
			name: input.name,
			fingerprint,
			privateKeyEncrypted: encrypted.encrypted,
			privateKeyIv: encrypted.iv,
			privateKeyTag: encrypted.tag,
			tags: input.tags ?? [],
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		.execute();
	const [row] = await db.select().from(sshKeys).where(eq(sshKeys.id, id)).execute();
	return mapSshKey(row);
};

export const listSshKeys = async (): Promise<SshKey[]> => {
	const db = await getDb();
	const rows = await db.select().from(sshKeys).execute();
	return rows.map(mapSshKey);
};

export const getSshKeyById = async (id: string): Promise<SshKey | null> => {
	const db = await getDb();
	const [row] = await db.select().from(sshKeys).where(eq(sshKeys.id, id)).execute();
	return row ? mapSshKey(row) : null;
};

export const getSshKeyPrivateKey = async (id: string): Promise<string | null> => {
	const db = await getDb();
	const [row] = await db
		.select({
			privateKeyEncrypted: sshKeys.privateKeyEncrypted,
			privateKeyIv: sshKeys.privateKeyIv,
			privateKeyTag: sshKeys.privateKeyTag,
		})
		.from(sshKeys)
		.where(eq(sshKeys.id, id))
		.execute();
	if (!row) return null;
	return decryptValue(row.privateKeyEncrypted, row.privateKeyIv, row.privateKeyTag, config.envEncryptionKey);
};

export const deleteSshKey = async (id: string): Promise<boolean> => {
	const db = await getDb();
	return getRowsAffected(await db.delete(sshKeys).where(eq(sshKeys.id, id)).execute()) > 0;
};

export const resolveServerSshKey = async (server: {
	sshKeyId?: string | null;
	sshKey?: string | null;
	sshKeyIv?: string | null;
	sshKeyTag?: string | null;
}): Promise<string | null> => {
	if (server.sshKeyId) {
		const privateKey = await getSshKeyPrivateKey(server.sshKeyId);
		if (privateKey) return privateKey;
	}
	if (server.sshKey && server.sshKeyIv && server.sshKeyTag) {
		return decryptValue(server.sshKey, server.sshKeyIv, server.sshKeyTag, config.envEncryptionKey);
	}
	return null;
};
