import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const runEngineSuite = () => {
	const result = spawnSync("bun", ["test", join(import.meta.dir, "engine-runner.ts")], {
		cwd: join(import.meta.dir, "../.."),
		env: {
			...process.env,
			TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://dequel:dequel@localhost:5434/dequel",
		},
		encoding: "utf8",
		timeout: 120_000,
	});
	if (result.status !== 0) {
		throw new Error(`Scaling engine suite failed:\n${result.stdout}\n${result.stderr}`);
	}
	return result.status;
};

describe("scaling engine", () => {
	it("passes every scaling engine scenario", () => {
		expect(runEngineSuite()).toBe(0);
	}, 120_000);
});
