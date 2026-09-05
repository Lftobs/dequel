import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const runnerPath = join(import.meta.dir, "databases-repo-runner.ts");

const runRepoScenarios = (): any => {
	const result = spawnSync("bun", [runnerPath], {
		env: {
			...process.env,
			DATABASE_URL: "postgresql://dequel:dequel@localhost:5433/dequel",
			TEST_DATABASE_URL: "postgresql://dequel:dequel@localhost:5433/dequel",
		},
		encoding: "utf8",
	});
	if (result.status !== 0) {
		throw new Error(`Repo test runner failed:\n${result.stdout}\n${result.stderr}`);
	}
	for (const line of result.stdout.split("\n").reverse()) {
		try {
			return JSON.parse(line);
		} catch {}
	}
	throw new Error(`Repo test runner produced no JSON output:\n${result.stdout}`);
};

describe("Database Repository Tests", () => {
	it("creates standalone and project-attached databases against the migrated schema", () => {
		const result = runRepoScenarios();
		expect(result.standalone.projectId).toBeNull();
		expect(result.standalone.internalPort).toBe(5432);
		expect(result.standalone.status).toBe("provisioning");
		expect(result.standalone.publicAccess).toBe(true);
		expect(result.standalone.allowAnywhere).toBe(false);
		expect(result.standalone.volumeName).toMatch(/^db-[a-f0-9-]{12}$/);
		expect(result.standalone.connectionPrefix).toBe("postgresql:");
		expect(result.standalone.hasPassword).toBe(true);
	});

	it("persists project attachment, allowlist, and lifecycle updates", () => {
		const result = runRepoScenarios();
		expect(result.attached.projectId).toBe("proj-1");
		expect(result.attached.publicAccess).toBe(false);
		expect(result.attached.allowedCidrs).toEqual(["10.0.0.0/8"]);
		expect(result.attached.projectListCount).toBe(1);
		expect(result.updated.status).toBe("running");
		expect(result.updated.containerName).toBe("db-container-1");
		expect(result.updated.externalPort).toBe(30123);
		expect(result.updated.proxyContainerName).toBe("db-container-1-public");
		expect(result.updated.storageUsedMb).toBe(256);
		expect(result.deleted).toBe(true);
		expect(result.total).toBe(1);
	});
});
