import { describe, expect, it } from "bun:test";
import { proxyConfig, publicProxyName, resolveDbImage } from "../manager";
import type { Database } from "../../types";

const baseRecord = (overrides: Partial<Database> = {}): Database => ({
	id: "db-1234",
	projectId: null,
	name: "orders",
	type: "postgresql",
	version: "18",
	databaseName: "db_1234",
	username: "user_1234",
	password: "secret",
	internalHost: "db-1234",
	internalPort: 5432,
	cpuLimit: null,
	memoryLimitMb: null,
	storageLimitMb: 1024,
	storageUsedMb: 0,
	publicAccess: true,
	allowPublicAccessFromAnywhere: false,
	allowedCidrs: ["203.0.113.4/32"],
	externalPort: null,
	proxyContainerName: null,
	volumeName: "db-1234",
	connectionString: "postgresql://user_1234:secret@db-1234:5432/db_1234",
	status: "provisioning",
	containerName: null,
	createdAt: "",
	updatedAt: "",
	...overrides,
});

describe("database manager helpers", () => {
	it("resolves postgres images with alpine suffix", () => {
		expect(resolveDbImage("postgresql", "16")).toBe("postgres:16-alpine");
		expect(resolveDbImage("postgresql", "16-alpine")).toBe("postgres:16-alpine");
		expect(resolveDbImage("postgresql", "latest")).toBe("postgres:latest");
	});

	it("applies default versions when none are provided", () => {
		expect(resolveDbImage("postgresql")).toBe("postgres:18-alpine");
		expect(resolveDbImage("mysql")).toBe("mysql:8.4");
		expect(resolveDbImage("redis")).toBe("redis:8.0-alpine");
		expect(resolveDbImage("mongodb")).toBe("mongo:8.0");
	});

	it("rejects unsupported database types", () => {
		expect(() => resolveDbImage("sqlite")).toThrow("Unsupported database type: sqlite");
	});

	it("resolves mysql and redis images", () => {
		expect(resolveDbImage("mysql", "8.4")).toBe("mysql:8.4");
		expect(resolveDbImage("redis", "8.0")).toBe("redis:8.0-alpine");
		expect(resolveDbImage("mongodb")).toBe("mongo:8.0");
	});

	it("derives a deterministic proxy container name from the database host", () => {
		expect(publicProxyName(baseRecord())).toBe("db-1234-public");
	});

	it("embeds an allowlist ACL when not allowing access from anywhere", () => {
		const config = proxyConfig(baseRecord(), 30123);
		expect(config).toContain("bind 0.0.0.0:30123");
		expect(config).toContain("acl allowed src 203.0.113.4/32");
		expect(config).toContain("tcp-request connection reject if !allowed");
		expect(config).toContain("server database db-1234:5432 check");
	});

	it("omits the ACL when allowing access from anywhere", () => {
		const config = proxyConfig(baseRecord({ allowPublicAccessFromAnywhere: true }), 30123);
		expect(config).not.toContain("acl allowed");
		expect(config).not.toContain("tcp-request connection reject");
	});

	it("emits a reject ACL when the allowlist is empty", () => {
		const config = proxyConfig(baseRecord({ allowedCidrs: [] }), 30123);
		expect(config).toContain("acl allowed src ");
		expect(config).toContain("tcp-request connection reject if !allowed");
	});
});
