import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { setDbProvider } from "../db-provider";
import * as schema from "../schema";
import { createTestPool, truncateAllTables } from "../test-helper";

let pool: Pool;

beforeAll(async () => {
	pool = createTestPool();
	const db = drizzle(pool, { schema });
	setDbProvider(async () => db);
	await truncateAllTables(pool);
	await pool.query(
		`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-1', 'Test', 'git', NOW(), NOW()) ON CONFLICT DO NOTHING`,
	);
	await pool.query(
		`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-2', 'Test2', 'git', NOW(), NOW()) ON CONFLICT DO NOTHING`,
	);
});

afterEach(async () => {
	await truncateAllTables(pool);
	await pool.query(
		`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-1', 'Test', 'git', NOW(), NOW()) ON CONFLICT DO NOTHING`,
	);
	await pool.query(
		`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-2', 'Test2', 'git', NOW(), NOW()) ON CONFLICT DO NOTHING`,
	);
});

afterAll(async () => {
	try {
		await truncateAllTables(pool);
	} finally {
		await pool.end();
	}
});

describe("Domain CRUD", () => {
	describe("createDomain", () => {
		it("creates a domain with pending status", async () => {
			const { createDomain } = await import("../repo/domains");
			const domain = await createDomain({ projectId: "proj-1", domain: "app.example.com", type: "custom" });
			expect(domain.id).toBeDefined();
			expect(domain.projectId).toBe("proj-1");
			expect(domain.domain).toBe("app.example.com");
			expect(domain.type).toBe("custom");
			expect(domain.validationStatus).toBe("pending");
			expect(domain.sslStatus).toBe("pending");
			expect(domain.createdAt).toBeDefined();
			expect(domain.updatedAt).toBeDefined();
		});

		it("creates a base domain", async () => {
			const { createDomain } = await import("../repo/domains");
			const domain = await createDomain({ projectId: "proj-1", domain: "example.com", type: "base" });
			expect(domain.type).toBe("base");
		});
	});

	describe("listDomains", () => {
		it("lists domains for a project ordered by created_at desc", async () => {
			const { createDomain, listDomains } = await import("../repo/domains");
			await createDomain({ projectId: "proj-1", domain: "first.com", type: "custom" });
			await Bun.sleep(2);
			await createDomain({ projectId: "proj-1", domain: "second.com", type: "custom" });
			await createDomain({ projectId: "proj-2", domain: "other.com", type: "custom" });

			const domains = await listDomains("proj-1");
			expect(domains).toHaveLength(2);
			expect(domains[0].domain).toBe("second.com");
			expect(domains[1].domain).toBe("first.com");
		});

		it("returns empty list when no domains exist", async () => {
			const { listDomains } = await import("../repo/domains");
			const domains = await listDomains("nonexistent");
			expect(domains).toEqual([]);
		});
	});

	describe("getDomainById", () => {
		it("returns domain by id", async () => {
			const { createDomain, getDomainById } = await import("../repo/domains");
			const created = await createDomain({ projectId: "proj-1", domain: "app.example.com", type: "custom" });
			const found = await getDomainById(created.id);
			expect(found).toEqual(created);
		});

		it("returns null for nonexistent id", async () => {
			const { getDomainById } = await import("../repo/domains");
			expect(await getDomainById("nonexistent")).toBeNull();
		});
	});

	describe("updateDomainValidation", () => {
		it("updates validation status", async () => {
			const { createDomain, getDomainById, updateDomainValidation } = await import("../repo/domains");
			const domain = await createDomain({ projectId: "proj-1", domain: "app.example.com", type: "custom" });
			await updateDomainValidation(domain.id, "verified", "provisioned");
			const updated = await getDomainById(domain.id);
			expect(updated?.validationStatus).toBe("verified");
			expect(updated?.sslStatus).toBe("provisioned");
		});

		it("does not overwrite ssl status when not provided", async () => {
			const { createDomain, getDomainById, updateDomainValidation } = await import("../repo/domains");
			const domain = await createDomain({ projectId: "proj-1", domain: "app.example.com", type: "custom" });
			await updateDomainValidation(domain.id, "failed");
			const updated = await getDomainById(domain.id);
			expect(updated?.validationStatus).toBe("failed");
			expect(updated?.sslStatus).toBe("pending");
		});

		it("updates the updated_at timestamp", async () => {
			const { createDomain, getDomainById, updateDomainValidation } = await import("../repo/domains");
			const domain = await createDomain({ projectId: "proj-1", domain: "app.example.com", type: "custom" });
			const before = new Date(domain.updatedAt).getTime();
			const start = Date.now();
			while (Date.now() - start < 2) {}
			await updateDomainValidation(domain.id, "verified");
			const updated = await getDomainById(domain.id);
			expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThan(before);
		});
	});

	describe("updateDomainSslStatus", () => {
		it("updates only ssl status", async () => {
			const { createDomain, getDomainById, updateDomainSslStatus } = await import("../repo/domains");
			const domain = await createDomain({ projectId: "proj-1", domain: "app.example.com", type: "custom" });
			await updateDomainSslStatus(domain.id, "provisioned");
			const updated = await getDomainById(domain.id);
			expect(updated?.sslStatus).toBe("provisioned");
			expect(updated?.validationStatus).toBe("pending");
		});
	});

	describe("deleteDomain", () => {
		it("deletes a domain and returns true", async () => {
			const { createDomain, getDomainById, deleteDomain } = await import("../repo/domains");
			const domain = await createDomain({ projectId: "proj-1", domain: "app.example.com", type: "custom" });
			const result = await deleteDomain(domain.id);
			expect(result).toBe(true);
			expect(await getDomainById(domain.id)).toBeNull();
		});

		it("returns false for nonexistent id", async () => {
			const { deleteDomain } = await import("../repo/domains");
			const result = await deleteDomain("nonexistent");
			expect(result).toBe(false);
		});

		it("does not affect other domains", async () => {
			const { createDomain, listDomains, deleteDomain } = await import("../repo/domains");
			const d1 = await createDomain({ projectId: "proj-1", domain: "first.com", type: "custom" });
			await createDomain({ projectId: "proj-1", domain: "second.com", type: "custom" });
			await deleteDomain(d1.id);
			const remaining = await listDomains("proj-1");
			expect(remaining).toHaveLength(1);
			expect(remaining[0].domain).toBe("second.com");
		});
	});

	describe("constraints", () => {
		it("generates unique ids", async () => {
			const { createDomain } = await import("../repo/domains");
			const d1 = await createDomain({ projectId: "proj-1", domain: "first.com", type: "custom" });
			const d2 = await createDomain({ projectId: "proj-1", domain: "second.com", type: "custom" });
			expect(d1.id).not.toBe(d2.id);
		});
	});
});
