import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { setDbProvider } from "../../db/db-provider";
import * as schema from "../../db/schema";
import { createTestPool, truncateAllTables } from "../../db/test-helper";

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
	await pool.end();
});

describe("auth routes", () => {
	it("GET /auth/me returns expiresIn when access token is valid", async () => {
		const { authRoutes } = await import("../auth/index");
		const { signAccessToken } = await import("../../utils/auth");
		const token = await signAccessToken("testuser");
		const res = await authRoutes.handle(
			new Request("http://localhost/auth/me", {
				headers: {
					cookie: `dequel_session=${token}`,
				},
			}),
		);
		expect(res.status).toBe(200);
		const json = (await res.json()) as {
			status: string;
			data: { authenticated: boolean; username: string; expiresIn: number };
		};
		expect(json.status).toBe("success");
		expect(json.data.authenticated).toBe(true);
		expect(json.data.username).toBe("testuser");
		expect(typeof json.data.expiresIn).toBe("number");
		expect(json.data.expiresIn).toBeGreaterThan(0);
		expect(json.data.expiresIn).toBeLessThanOrEqual(900);
	});

	it("GET /auth/me auto-refreshes when access token is missing but refresh token is valid", async () => {
		const { authRoutes } = await import("../auth/index");
		const { generateRefreshToken, storeRefreshToken } = await import("../../utils/auth");
		const rt = generateRefreshToken();
		await storeRefreshToken("testuser", rt);

		const res = await authRoutes.handle(
			new Request("http://localhost/auth/me", {
				headers: {
					cookie: `dequel_refresh=${rt}`,
				},
			}),
		);
		expect(res.status).toBe(200);
		const json = (await res.json()) as {
			status: string;
			data: { authenticated: boolean; username: string; expiresIn: number };
		};
		expect(json.status).toBe("success");
		expect(json.data.authenticated).toBe(true);
		expect(json.data.username).toBe("testuser");
		expect(json.data.expiresIn).toBe(900);

		const cookies = res.headers.get("set-cookie") || "";
		expect(cookies).toContain("dequel_session=");
		expect(cookies).toContain("dequel_refresh=");
	});

	it("GET /auth/me returns unauthenticated when no valid tokens exist", async () => {
		const { authRoutes } = await import("../auth/index");
		const res = await authRoutes.handle(new Request("http://localhost/auth/me"));
		expect(res.status).toBe(200);
		const json = (await res.json()) as { status: string; data: { authenticated: boolean } };
		expect(json.status).toBe("success");
		expect(json.data.authenticated).toBe(false);
	});

	it("POST /auth/refresh returns expiresIn: 900 and rotates tokens", async () => {
		const { authRoutes } = await import("../auth/index");
		const { generateRefreshToken, storeRefreshToken } = await import("../../utils/auth");
		const rt = generateRefreshToken();
		await storeRefreshToken("testuser", rt);

		const res = await authRoutes.handle(
			new Request("http://localhost/auth/refresh", {
				method: "POST",
				headers: {
					cookie: `dequel_refresh=${rt}`,
				},
			}),
		);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { status: string; data: { username: string; expiresIn: number } };
		expect(json.status).toBe("success");
		expect(json.data.username).toBe("testuser");
		expect(json.data.expiresIn).toBe(900);
	});
});
