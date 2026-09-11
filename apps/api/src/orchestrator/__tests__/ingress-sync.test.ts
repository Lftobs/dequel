import { describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const run = () =>
	exec("bun", ["run", "src/orchestrator/__tests__/ingress-sync-runner.ts"], {
		cwd: `${import.meta.dir}/../../..`,
		timeout: 30000,
		env: { ...process.env, TEST_DATABASE_URL: "postgresql://dequel:dequel@localhost:5433/dequel" },
	});

const parse = (stdout: string) => {
	const lines = stdout.trim().split("\n");
	return JSON.parse(lines[lines.length - 1]);
};

describe("rerenderAllIngressRoutes", () => {
	it("handles all scenarios correctly", async () => {
		const { stdout } = await run();
		const r = parse(stdout);

		expect(r.test1.listNotCalled).toBe(true);
		expect(r.test1.removeNotCalled).toBe(true);
		expect(r.test1.syncNotCalled).toBe(true);

		expect(r.test2.removeCount).toBe(2);
		expect(r.test2.syncCount).toBe(2);

		expect(r.test3.removeCount).toBe(1);
		expect(r.test3.syncNotCalled).toBe(true);

		expect(r.test4.removeNotCalled).toBe(true);
		expect(r.test4.syncNotCalled).toBe(true);

		expect(r.test5.noThrow).toBe(true);
	});
});
