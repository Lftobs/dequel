import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const runRouteReconcileSuite = () => {
	const result = spawnSync("bun", ["test", join(import.meta.dir, "route-reconcile-runner.ts")], {
		cwd: join(import.meta.dir, "../.."),
		env: {
			...process.env,
			TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://dequl:dequl@localhost:5434/dequl",
		},
		encoding: "utf8",
		timeout: 60_000,
	});
	if (result.status !== 0) {
		throw new Error(`Route reconcile suite failed:\n${result.stdout}\n${result.stderr}`);
	}
	return result.status;
};

describe("route reconciliation", () => {
	it("passes every local routing scenario", () => {
		expect(runRouteReconcileSuite()).toBe(0);
	}, 60_000);
});
