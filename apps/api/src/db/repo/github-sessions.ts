import { eq } from "drizzle-orm";
import { config } from "../../utils/config";
import { decryptValue, encryptValue } from "../../utils/crypto";
import { getDb } from "../db-provider";
import { githubSessions } from "../schema";

export const getGithubSession = async (id: string): Promise<string | null> => {
	const db = await getDb();
	const [row] = await db.select().from(githubSessions).where(eq(githubSessions.id, id)).execute();
	if (!row) return null;
	return decryptValue(row.accessTokenEncrypted, row.accessTokenIv, row.accessTokenTag, config.envEncryptionKey);
};

export const createGithubSession = async (id: string, accessToken: string): Promise<void> => {
	const db = await getDb();
	const enc = encryptValue(accessToken, config.envEncryptionKey);
	await db
		.insert(githubSessions)
		.values({
			id,
			accessTokenEncrypted: enc.encrypted,
			accessTokenIv: enc.iv,
			accessTokenTag: enc.tag,
		})
		.execute();
};

export const deleteGithubSession = async (id: string): Promise<void> => {
	const db = await getDb();
	await db.delete(githubSessions).where(eq(githubSessions.id, id)).execute();
};
