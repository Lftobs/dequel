import { describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const run = () =>
	exec("bun", ["run", "src/api/__tests__/domains-status-runner.ts"], {
		cwd: `${import.meta.dir}/../../..`,
		timeout: 30000,
		env: { ...process.env, TEST_DATABASE_URL: "postgresql://dequel:dequel@localhost:5433/dequel" },
	});

const parse = (stdout: string) => {
	const lines = stdout.trim().split("\n");
	return JSON.parse(lines[lines.length - 1]);
};

describe("GET /projects/:id/domains/status", () => {
	it("returns array and 404 for missing project", async () => {
		const { stdout, stderr } = await run();
		const results = parse(stdout);
		expect(results.test1.status).toBe(200);
		expect(results.test1.isArray).toBe(true);
		expect(results.test1.length).toBe(2);
		expect(results.test2.status).toBe(404);
		expect(results.test3.status).toBe(200);
		expect(results.test3.length).toBe(0);
	}, 30_000);
});
