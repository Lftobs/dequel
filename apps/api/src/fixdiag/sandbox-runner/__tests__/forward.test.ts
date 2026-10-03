import { describe, expect, it, mock } from "bun:test";
import { forwardWithFallback, type Forwardable } from "../forward";

mock.restore();

const answerOnly = (): Forwardable => ({
	forward: async () => ({ cause: "unknown" }),
});

describe("forwardWithFallback", () => {
	it("returns the first result when the program finishes in budget", async () => {
		const prog: Forwardable = {
			forward: async () => ({ cause: "dequel-source" }),
		};
		const out = await forwardWithFallback(prog, answerOnly(), {}, { q: "x" }, "/tmp/nonexistent-progress.log");
		expect(out).toEqual({ cause: "dequel-source" });
	});

	it("retries answer-only on shared memory after max steps", async () => {
		const calls: Record<string, unknown>[] = [];
		let n = 0;
		const prog: Forwardable = {
			forward: async (_llm, _values, opts) => {
				calls.push(opts ?? {});
				n += 1;
				if (n === 1) throw new Error("Generate failed: Max steps reached: 20");
				return { cause: "unknown" };
			},
		};
		const answerCalls: Record<string, unknown>[] = [];
		const fallback: Forwardable = {
			forward: async (_llm, _values, opts) => {
				answerCalls.push(opts ?? {});
				return { cause: "unknown" };
			},
		};
		const out = await forwardWithFallback(prog, fallback, {}, { q: "x" }, "/tmp/nonexistent-progress.log");
		expect(out).toEqual({ cause: "unknown" });
		expect(calls).toHaveLength(1);
		expect(answerCalls).toHaveLength(1);
		expect(answerCalls[0]).toMatchObject({ functionCall: "none" });
		expect((answerCalls[0] as Record<string, unknown>).mem).toBe((calls[0] as Record<string, unknown>).mem);
	});

	it("rethrows errors other than max steps", async () => {
		const prog: Forwardable = {
			forward: async () => {
				throw new Error("Generate failed: HTTP 429 - Too Many Requests");
			},
		};
		await expect(
			forwardWithFallback(prog, answerOnly(), {}, { q: "x" }, "/tmp/nonexistent-progress.log"),
		).rejects.toThrow(/429/);
	});

	it("detects max steps buried in a wrapper error chain", async () => {
		const prog: Forwardable = {
			forward: async () => {
				throw new Error("Generate failed", { cause: new Error("Max steps reached: 20") });
			},
		};
		const out = await forwardWithFallback(prog, answerOnly(), {}, { q: "x" }, "/tmp/nonexistent-progress.log");
		expect(out).toEqual({ cause: "unknown" });
	});
});
