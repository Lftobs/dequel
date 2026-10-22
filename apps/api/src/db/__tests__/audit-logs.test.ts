import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { countAuditLogs, createAuditLog, listAuditLogs } from "../repo/audit-logs";
import { setupTestDb, teardownTestDb, truncateAllTables } from "../test-helper";

describe("Audit Logs Repository", () => {
	let pool: any;

	beforeAll(async () => {
		const res = await setupTestDb();
		pool = res.pool;
	});

	beforeEach(async () => {
		await truncateAllTables(pool);
	});

	afterAll(async () => {
		await teardownTestDb(pool);
	});

	it("creates and lists audit logs with filtering", async () => {
		const log1 = await createAuditLog({
			actorType: "user",
			actorId: "admin",
			action: "project.create",
			resourceType: "project",
			resourceId: "proj-1",
			details: { name: "test-app" },
			ipAddress: "192.168.1.1",
			userAgent: "Mozilla/5.0",
		});

		expect(log1.id).toBeDefined();
		expect(log1.action).toBe("project.create");
		expect(log1.actorId).toBe("admin");
		expect(log1.details).toEqual({ name: "test-app" });

		const log2 = await createAuditLog({
			actorType: "api_key",
			actorId: "key-123",
			action: "deployment.trigger",
			resourceType: "deployment",
			resourceId: "dep-1",
		});

		const allLogs = await listAuditLogs();
		expect(allLogs).toHaveLength(2);
		expect(await countAuditLogs()).toBe(2);

		const userLogs = await listAuditLogs({ actorType: "user" });
		expect(userLogs).toHaveLength(1);
		expect(userLogs[0].id).toBe(log1.id);

		const depLogs = await listAuditLogs({ resourceType: "deployment" });
		expect(depLogs).toHaveLength(1);
		expect(depLogs[0].id).toBe(log2.id);
	});
});
