import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const runCleanupSuite = () => {
	const result = spawnSync("bun", ["test", join(import.meta.dir, "pipeline-cleanup-runner.ts")], {
		cwd: join(import.meta.dir, "../.."),
		env: {
			...process.env,
			TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://dequel:dequel@localhost:5434/dequel",
		},
		encoding: "utf8",
		timeout: 60_000,
	});
	if (result.status !== 0) {
		throw new Error(`Pipeline cleanup suite failed:\n${result.stdout}\n${result.stderr}`);
	}
	return result.status;
};

describe("pipeline cleanup", () => {
	it("passes every cleanup scenario", () => {
		expect(runCleanupSuite()).toBe(0);
	}, 60_000);
});
