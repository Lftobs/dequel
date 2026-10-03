import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { setDbProvider } from "../db-provider";
import * as schema from "../schema";
import { createTestPool, truncateAllTables } from "../test-helper";
import { deleteLlmKey, getDecryptedLlmKey, getLlmKeyStatus, updateLlmModels, upsertLlmKey } from "../repo/llm-keys";

let pool: Pool;

mock.restore();

beforeAll(async () => {
	pool = createTestPool();
	const db = drizzle(pool, { schema });
	setDbProvider(async () => db);
	await truncateAllTables(pool);
});

afterAll(async () => {
	try {
		await truncateAllTables(pool);
	} finally {
		await pool.end();
	}
});

describe("llm-keys", () => {
	it("stores encrypted and reports status without the secret", async () => {
		const status = await upsertLlmKey({
			provider: "groq",
			apiKey: "gsk-secret-1",
			models: ["llama-3.3-70b-versatile"],
		});
		expect(status.provider).toBe("groq");
		expect(status.configured).toBe(true);
		expect(status.models).toEqual(["llama-3.3-70b-versatile"]);
		expect(JSON.stringify(status)).not.toContain("gsk-secret-1");

		const all = await getLlmKeyStatus();
		expect(all.find((s) => s.provider === "groq")?.configured).toBe(true);
		expect(JSON.stringify(all)).not.toContain("gsk-secret-1");
	});

	it("round-trips the decrypted key", async () => {
		await upsertLlmKey({ provider: "openai", apiKey: "sk-secret-2" });
		const rec = await getDecryptedLlmKey("openai");
		expect(rec?.apiKey).toBe("sk-secret-2");
		expect(await getDecryptedLlmKey("missing")).toBeNull();
	});

	it("keeps the old key when apiKey is empty", async () => {
		await upsertLlmKey({ provider: "groq", apiKey: "gsk-secret-1" });
		const status = await upsertLlmKey({ provider: "groq", apiKey: "", models: ["other-model"] });
		expect(status.configured).toBe(true);
		expect(status.models).toEqual(["other-model"]);
		expect((await getDecryptedLlmKey("groq"))?.apiKey).toBe("gsk-secret-1");
	});

	it("updates models for a provider", async () => {
		await upsertLlmKey({ provider: "gemini", apiKey: "gem-sec-1" });
		const updated = await updateLlmModels("gemini", ["gemini-2.5-flash", "gemini-2.5-pro"]);
		expect(updated?.models).toEqual(["gemini-2.5-flash", "gemini-2.5-pro"]);
		expect(await updateLlmModels("nonexistent", ["model"])).toBeNull();
	});

	it("deletes keys", async () => {
		await upsertLlmKey({ provider: "anthropic", apiKey: "sk-ant-1" });
		expect(await deleteLlmKey("anthropic")).toBe(true);
		expect(await deleteLlmKey("anthropic")).toBe(false);
		expect((await getLlmKeyStatus()).find((s) => s.provider === "anthropic")).toBeUndefined();
	});
});
