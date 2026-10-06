import { describe, expect, it } from "bun:test";
import { killProcessGroup, safeSpawn, terminateWithEscalation } from "../process-exec";

describe("process-exec", () => {
	it("executes a basic command and captures stdout", async () => {
		const res = await safeSpawn("echo", ["hello-process-exec"]);
		expect(res.code).toBe(0);
		expect(res.stdout).toBe("hello-process-exec");
		expect(res.stderr).toBe("");
	});

	it("captures non-zero exit code and stderr", async () => {
		const res = await safeSpawn("sh", ["-c", "echo 'err-msg' >&2; exit 42"]);
		expect(res.code).toBe(42);
		expect(res.stderr).toBe("err-msg");
	});

	it("streams lines via onLine callback", async () => {
		const lines: string[] = [];
		await safeSpawn("sh", ["-c", "echo 'line1'; echo 'line2'"], {
			onLine: (l) => lines.push(l),
		});
		expect(lines).toContain("line1");
		expect(lines).toContain("line2");
	});

	it("terminates process on abort signal", async () => {
		const ac = new AbortController();
		setTimeout(() => ac.abort(), 50);
		const start = Date.now();
		let error: Error | null = null;
		try {
			await safeSpawn("sleep", ["10"], {
				signal: ac.signal,
				killSignalTimeoutMs: 100,
			});
		} catch (err: any) {
			error = err;
		}
		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(3000);
		expect(error).not.toBeNull();
		expect(error?.message).toContain("aborted");
	});

	it("terminates process on timeoutMs", async () => {
		const start = Date.now();
		let error: Error | null = null;
		try {
			await safeSpawn("sleep", ["10"], {
				timeoutMs: 100,
				killSignalTimeoutMs: 100,
			});
		} catch (err: any) {
			error = err;
		}
		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(3000);
		expect(error).not.toBeNull();
		expect(error?.message).toContain("timed out");
	});
});
