import { describe, expect, it, mock } from "bun:test";
import { createPrograms } from "../programs";
import { heuristicSignalLines } from "../programs";
import type { DiagLlm } from "../llm";

mock.restore();

const throwingLlm = (): DiagLlm =>
	({
		chat: async () => {
			throw new Error("Generate failed: boom");
		},
	}) as unknown as DiagLlm;

describe("program fallbacks", () => {
	it("triage falls back to heuristic signal lines", async () => {
		const progs = createPrograms(throwingLlm());
		const out = await progs.triageLogs({
			failureReason: "boom",
			logText: "[build] ok\n[build] ERROR: dial tcp: lookup ghcr.io: server misbehaving\n[system] done",
		});
		expect(out.confidence).toBe("low");
		expect(out.failingStage).toBe("unknown");
		expect(out.signalLines).toEqual(["[build] ERROR: dial tcp: lookup ghcr.io: server misbehaving"]);
	});

	it("explain falls back to the localization rationale", async () => {
		const progs = createPrograms(throwingLlm());
		const out = await progs.explainFix({
			verdict: { failingStage: "x", signalLines: [], confidence: "low" },
			localization: { cause: "dequel-source", culpritPaths: [], rationale: "dns broke" },
		});
		expect(out.summary).toBe("dns broke");
		expect(out.fixSteps).toEqual([]);
		expect(out.patchHint).toBeNull();
	});

	it("propose falls back to a minimal dequel report", async () => {
		const progs = createPrograms(throwingLlm());
		const out = await progs.draftProposal({
			localization: { cause: "dequel-source", culpritPaths: [], rationale: "dns broke" },
			explanation: { summary: "s", fixSteps: [], patchHint: null },
			repo: null,
		});
		expect(out.cause).toBe("dequel-source");
		expect(out.dequelReport?.problem).toBe("dns broke");
	});

	it("propose skips the model for unknown cause", async () => {
		const progs = createPrograms(throwingLlm());
		const out = await progs.draftProposal({
			localization: { cause: "unknown", culpritPaths: [], rationale: "" },
			explanation: { summary: "s", fixSteps: [], patchHint: null },
			repo: null,
		});
		expect(out).toEqual({ cause: "unknown" });
	});
});

describe("heuristicSignalLines", () => {
	it("prefers error lines, else the tail", () => {
		expect(heuristicSignalLines("[build] ok\n[build] ERROR: x\n[system] done")).toEqual(["[build] ERROR: x"]);
		expect(heuristicSignalLines("a\nb")).toEqual(["a", "b"]);
		expect(heuristicSignalLines("")).toEqual([]);
	});
});
