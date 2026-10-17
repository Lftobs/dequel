import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { setDbProvider } from "../db-provider";
import * as schema from "../schema";
import { createTestPool, truncateAllTables } from "../test-helper";

const TEST_SECRET = "test-jwt-secret-for-testing-purposes-only";
let pool: Pool;

beforeAll(async () => {
	pool = createTestPool();
	const db = drizzle(pool, { schema });
	setDbProvider(async () => db);
	const { initAuth } = await import("../../utils/auth");
	initAuth(TEST_SECRET);
});

beforeEach(async () => {
	await truncateAllTables(pool);
});

afterAll(async () => {
	await truncateAllTables(pool);
});

describe("github integrations store secrets encrypted", () => {
	it("writes ciphertext for client and webhook secrets", async () => {
		const gh = await import("../repo/github");
		await gh.setGithubIntegration({
			clientId: "Iv1.testapp",
			clientSecret: "gh-canary-secret",
			webhookSecret: "hook-canary-secret",
		});

		const [rawRow] = await pool
			.query(
				"SELECT client_secret, client_secret_iv, client_secret_tag, webhook_secret, webhook_secret_iv FROM github_integrations",
			)
			.then((r: any) => r.rows);
		expect(rawRow.client_secret).not.toBe("gh-canary-secret");
		expect(rawRow.client_secret).toContain("");
		expect(rawRow.client_secret_iv).toBeTruthy();
		expect(rawRow.client_secret_tag).toBeTruthy();
		expect(rawRow.webhook_secret).not.toBe("hook-canary-secret");
		expect(rawRow.webhook_secret_iv).toBeTruthy();

		const read = await gh.getGithubIntegration();
		expect(read?.clientSecret).toBe("gh-canary-secret");
		expect(read?.webhookSecret).toBe("hook-canary-secret");
	});

	it("keeps an existing webhook secret when the update omits one", async () => {
		const gh = await import("../repo/github");
		await gh.setGithubIntegration({
			clientId: "Iv1.testapp",
			clientSecret: "secret-a",
			webhookSecret: "hook-keep-me",
		});
		const second = await gh.setGithubIntegration({
			clientId: "Iv1.testapp2",
			clientSecret: "secret-b",
		});
		expect(second.clientSecret).toBe("secret-b");
		expect(second.webhookSecret).toBe("hook-keep-me");

		const read = await gh.getGithubIntegration();
		expect(read?.webhookSecret).toBe("hook-keep-me");
	});

	it("decrypts rows migrated from legacy plaintext", async () => {
		const gh = await import("../repo/github");
		const db = drizzle(pool, { schema });

		await db.insert(schema.githubIntegrations).values({
			id: "legacy-row",
			clientId: "Iv1.legacy",
			clientSecret: "gh-plan-secret",
			appName: "Dequel",
			createdAt: new Date(),
		});

		const read = await gh.getGithubIntegration();
		expect(read?.clientSecret).toBe("gh-plan-secret");
	});
});
