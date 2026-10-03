import { eq } from "drizzle-orm";
import { config } from "../../utils/config";
import { decryptValue, encryptValue } from "../../utils/crypto";
import { getDb } from "../db-provider";
import { llmProviderKeys } from "../schema";
import { now } from "./helpers";

export const LLM_PROVIDERS = ["openai", "anthropic", "gemini", "groq", "ollama", "custom"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export interface LlmKeyStatus {
	provider: string;
	configured: boolean;
	baseUrl: string | null;
	models: string[];
}

export interface LlmKeyInput {
	provider: string;
	apiKey: string;
	baseURL?: string;
	models?: string[];
}

const toStatus = (row: typeof llmProviderKeys.$inferSelect): LlmKeyStatus => ({
	provider: row.provider,
	configured: !!(row.keyEncrypted && row.keyIv && row.keyTag),
	baseUrl: row.baseUrl,
	models: (row.models as string[]) ?? [],
});

export const getLlmKeyStatus = async (): Promise<LlmKeyStatus[]> => {
	const db = await getDb();
	const rows = await db.select().from(llmProviderKeys).execute();
	return rows.map(toStatus);
};

export const getDecryptedLlmKey = async (
	provider: string,
): Promise<{ apiKey: string; baseUrl: string | null; models: string[] } | null> => {
	const db = await getDb();
	const [row] = await db.select().from(llmProviderKeys).where(eq(llmProviderKeys.provider, provider)).execute();
	if (!row?.keyEncrypted || !row.keyIv || !row.keyTag) return null;
	return {
		apiKey: decryptValue(row.keyEncrypted, row.keyIv, row.keyTag, config.envEncryptionKey),
		baseUrl: row.baseUrl,
		models: (row.models as string[]) ?? [],
	};
};

export const upsertLlmKey = async (input: LlmKeyInput): Promise<LlmKeyStatus> => {
	const db = await getDb();
	const encrypted = input.apiKey ? encryptValue(input.apiKey, config.envEncryptionKey) : null;
	const timestamp = now();
	const [existing] = await db
		.select()
		.from(llmProviderKeys)
		.where(eq(llmProviderKeys.provider, input.provider))
		.execute();
	if (existing) {
		const [updated] = await db
			.update(llmProviderKeys)
			.set({
				keyEncrypted: encrypted?.encrypted ?? existing.keyEncrypted,
				keyIv: encrypted?.iv ?? existing.keyIv,
				keyTag: encrypted?.tag ?? existing.keyTag,
				baseUrl: input.baseURL ?? existing.baseUrl,
				models: input.models ?? existing.models,
				updatedAt: timestamp,
			})
			.where(eq(llmProviderKeys.provider, input.provider))
			.returning()
			.execute();
		return toStatus(updated);
	}
	const [inserted] = await db
		.insert(llmProviderKeys)
		.values({
			provider: input.provider,
			keyEncrypted: encrypted?.encrypted ?? null,
			keyIv: encrypted?.iv ?? null,
			keyTag: encrypted?.tag ?? null,
			baseUrl: input.baseURL ?? null,
			models: input.models ?? [],
			updatedAt: timestamp,
		})
		.returning()
		.execute();
	return toStatus(inserted);
};

export const deleteLlmKey = async (provider: string): Promise<boolean> => {
	const db = await getDb();
	const deleted = await db.delete(llmProviderKeys).where(eq(llmProviderKeys.provider, provider)).returning().execute();
	return deleted.length > 0;
};

export const updateLlmModels = async (provider: string, models: string[]): Promise<LlmKeyStatus | null> => {
	const db = await getDb();
	const [updated] = await db
		.update(llmProviderKeys)
		.set({
			models,
			updatedAt: now(),
		})
		.where(eq(llmProviderKeys.provider, provider))
		.returning()
		.execute();
	return updated ? toStatus(updated) : null;
};
