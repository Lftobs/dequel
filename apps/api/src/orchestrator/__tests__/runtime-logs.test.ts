import { describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const run = () =>
	exec("bun", ["run", "src/orchestrator/__tests__/runtime-logs-runner.ts"], {
		cwd: `${import.meta.dir}/../../..`,
		timeout: 30000,
	});

const parse = (stdout: string) => {
	const lines = stdout.trim().split("\n");
	return JSON.parse(lines[lines.length - 1]);
};

describe("runtime logs target the deployment's server", () => {
	it("reads logs through the remote server and maps lines", async () => {
		const { stdout } = await run();
		const results = parse(stdout);

		expect(results.readOnRemote.count).toBe(2);
		expect(results.readOnRemote.first).toEqual({ sequence: 1, message: "line one", stage: "runtime" });
		expect(results.readOnRemote.serverPassed).toBe(true);
		expect(results.readOnRemote.command).toEqual(["docker", ["logs", "--tail", "200", "app-old"]]);

		expect(results.readLocal.count).toBe(2);
		expect(results.readLocal.command).toEqual(["docker", ["logs", "--tail", "200", "deploy-dep-2"]]);
		expect(results.readLocal.serverNull).toBe(true);

		expect(results.follower.serverPassed).toBe(true);
		expect(results.follower.args).toEqual([
			"-H",
			"ssh://root@1.2.3.4:22",
			"logs",
			"--tail",
			"100",
			"--follow",
			"app-1",
		]);

		expect(results.followerLocal.serverNull).toBe(true);
		expect(results.followerLocal.args).toEqual(["logs", "--tail", "100", "--follow", "deploy-dep-4"]);
	}, 30_000);
});
