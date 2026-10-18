import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { GithubIntegration } from "../../types";
import { config } from "../../utils/config";
import { decryptValue, encryptValue } from "../../utils/crypto";
import { getDb } from "../db-provider";
import { githubIntegrations } from "../schema";
import { now } from "./helpers";

const decryptOrRaw = (value: string, iv: string | null, tag: string | null, field: string): string => {
	if (!iv || !tag) return value;
	try {
		return decryptValue(value, iv, tag, config.envEncryptionKey);
	} catch {
		console.warn(`[GithubIntegration] could not decrypt ${field} (check ENV_ENCRYPTION_KEY)`);
		return "";
	}
};

const mapGithubIntegration = (row: typeof githubIntegrations.$inferSelect): GithubIntegration => ({
	id: row.id,
	clientId: row.clientId,
	clientSecret: decryptOrRaw(row.clientSecret, row.clientSecretIv, row.clientSecretTag, "clientSecret"),
	appName: row.appName,
	webhookSecret: row.webhookSecret
		? decryptOrRaw(row.webhookSecret, row.webhookSecretIv, row.webhookSecretTag, "webhookSecret")
		: null,
	createdAt: row.createdAt,
});

export const getGithubIntegration = async (): Promise<GithubIntegration | null> => {
	const db = await getDb();
	const [row] = await db
		.select()
		.from(githubIntegrations)
		.orderBy(desc(githubIntegrations.createdAt))
		.limit(1)
		.execute();
	return row ? mapGithubIntegration(row) : null;
};

export const setGithubIntegration = async (input: {
	clientId: string;
	clientSecret: string;
	appName?: string;
	webhookSecret?: string;
}): Promise<GithubIntegration> => {
	const db = await getDb();
	const client = encryptValue(input.clientSecret, config.envEncryptionKey);
	const webhook = input.webhookSecret ? encryptValue(input.webhookSecret, config.envEncryptionKey) : null;

	return db.transaction(async (tx) => {
		const [existing] = await tx
			.select()
			.from(githubIntegrations)
			.orderBy(desc(githubIntegrations.createdAt))
			.limit(1)
			.execute();
		const timestamp = now();

		if (existing) {
			await tx
				.update(githubIntegrations)
				.set({
					clientId: input.clientId,
					clientSecret: client.encrypted,
					clientSecretIv: client.iv,
					clientSecretTag: client.tag,
					appName: input.appName ?? "Dequel",
					...(webhook
						? { webhookSecret: webhook.encrypted, webhookSecretIv: webhook.iv, webhookSecretTag: webhook.tag }
						: {}),
				})
				.where(eq(githubIntegrations.id, existing.id))
				.execute();
			const [updated] = await tx
				.select()
				.from(githubIntegrations)
				.where(eq(githubIntegrations.id, existing.id))
				.execute();
			return mapGithubIntegration(updated);
		}

		const id = randomUUID();
		await tx
			.insert(githubIntegrations)
			.values({
				id,
				clientId: input.clientId,
				clientSecret: client.encrypted,
				clientSecretIv: client.iv,
				clientSecretTag: client.tag,
				appName: input.appName ?? "Dequel",
				webhookSecret: webhook?.encrypted ?? null,
				webhookSecretIv: webhook?.iv ?? null,
				webhookSecretTag: webhook?.tag ?? null,
				createdAt: timestamp,
			})
			.execute();
		const [inserted] = await tx.select().from(githubIntegrations).where(eq(githubIntegrations.id, id)).execute();
		return mapGithubIntegration(inserted);
	});
};
