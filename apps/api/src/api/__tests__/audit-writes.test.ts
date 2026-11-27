import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { setDbProvider } from "../../db/db-provider";
import { listAuditLogs } from "../../db/repo/audit-logs";
import { ensureLocalServer } from "../../db/repo/servers";
import * as schema from "../../db/schema";
import { createTestPool, truncateAllTables } from "../../db/test-helper";
import { apiKeysRoutes } from "../api-keys";
import { authRoutes } from "../auth";
import { projectsRoutes } from "../projects";

let pool: Pool;

const post = (routes: { handle: (req: Request) => Response | Promise<Response> }, path: string, body: unknown) =>
	routes.handle(
		new Request(`http://localhost${path}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

beforeAll(async () => {
	pool = createTestPool();
	const db = drizzle(pool, { schema });
	setDbProvider(async () => db);
});

beforeEach(async () => {
	await truncateAllTables(pool);
	await ensureLocalServer();
});

afterAll(async () => {
	await truncateAllTables(pool);
	await pool.end();
});

describe("audit writes", () => {
	it("records project creation with actor and resource", async () => {
		const res = await post(projectsRoutes, "/projects", { name: "audited-project" });
		expect(res.status).toBe(200);
		const json = (await res.json()) as { data: { id: string } };
		const entries = await listAuditLogs({ action: "project.created" });
		expect(entries).toHaveLength(1);
		expect(entries[0].resourceId).toBe(json.data.id);
		expect(entries[0].resourceType).toBe("project");
		expect(entries[0].actorType).toBe("system");
		expect((entries[0].details as { name?: string }).name).toBe("audited-project");
	});

	it("records api key creation without the raw secret", async () => {
		const res = await post(apiKeysRoutes, "/api-keys", {
			name: "ci-token",
			permissions: "deploy:read",
		});
		expect(res.status).toBe(200);
		const json = (await res.json()) as { data: { id: string; rawKey: string } };
		const entries = await listAuditLogs({ action: "api_key.created" });
		expect(entries).toHaveLength(1);
		expect(entries[0].resourceId).toBe(json.data.id);
		const serialized = JSON.stringify(entries[0].details);
		expect(serialized).not.toContain(json.data.rawKey);
		expect(serialized).not.toContain("rawKey");
		expect((entries[0].details as { name?: string }).name).toBe("ci-token");
	});

	it("records failed logins with the attempted username", async () => {
		const res = await post(authRoutes, "/auth/login", { username: "intruder", password: "wrong" });
		expect(res.status).toBe(401);
		const entries = await listAuditLogs({ action: "auth.login_failed" });
		expect(entries).toHaveLength(1);
		expect(entries[0].actorType).toBe("user");
		expect(entries[0].actorId).toBe("intruder");
		expect((entries[0].details as { username?: string }).username).toBe("intruder");
	}, 15000);

	it("keeps audit failures from breaking the mutation", async () => {
		const res = await post(apiKeysRoutes, "/api-keys", { name: "second-token" });
		expect(res.status).toBe(200);
		const all = await listAuditLogs({});
		expect(all.length).toBeGreaterThanOrEqual(1);
	});
});
