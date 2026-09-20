import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const runnerPath = join(import.meta.dir, "shared-env-links-runner.ts");

const runScenarios = (): any => {
	const result = spawnSync("bun", [runnerPath], {
		env: {
			...process.env,
			DATABASE_URL: "postgresql://dequel:dequel@localhost:5433/dequel",
			TEST_DATABASE_URL: "postgresql://dequel:dequel@localhost:5433/dequel",
		},
		encoding: "utf8",
	});
	if (result.status !== 0) {
		throw new Error(`Shared env links test runner failed:\n${result.stdout}\n${result.stderr}`);
	}
	for (const line of result.stdout.split("\n").reverse()) {
		try {
			return JSON.parse(line);
		} catch {}
	}
	throw new Error(`Shared env links test runner produced no JSON output:\n${result.stdout}`);
};

describe("Shared Env Var Linking", () => {
	it("links shared vars and returns linkId", () => {
		const result = runScenarios();
		expect(result.linkCount).toBe(2);
		expect(result.hasVar1).toBe(true);
		expect(result.hasVar2).toBe(true);
		expect(result.hasLinkId).toBe(true);
	});

	it("deduplicates on re-link", () => {
		const result = runScenarios();
		expect(result.afterRelink).toBe(2);
	});

	it("unlinks by key and redeploy data is correct", () => {
		const result = runScenarios();
		expect(result.unlinkResult).toBe(true);
		expect(result.afterUnlink).toBe(1);
		expect(result.stillHasVar1).toBe(true);
	});

	it("returns false for non-existent unlink", () => {
		const result = runScenarios();
		expect(result.badUnlink).toBe(false);
	});

	it("returns empty after all unlinked", () => {
		const result = runScenarios();
		expect(result.emptyCount).toBe(0);
	});
});
