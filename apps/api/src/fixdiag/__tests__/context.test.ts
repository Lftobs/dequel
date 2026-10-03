import { describe, expect, it, mock } from "bun:test";
import { failureReasonOf, logTextOf, tailLogs } from "../context";
import type { LogLine } from "../types";

mock.restore();

const line = (sequence: number, message: string): LogLine => ({ sequence, stage: "build", message });

describe("tailLogs", () => {
	it("keeps the last lines within limits", () => {
		const logs = Array.from({ length: 500 }, (_, i) => line(i + 1, `line ${i + 1}`));
		const tail = tailLogs(logs);
		expect(tail).toHaveLength(400);
		expect(tail[0].sequence).toBe(101);
	});

	it("caps total characters from the front", () => {
		const logs = [line(1, "a".repeat(20000)), line(2, "b".repeat(20000))];
		const tail = tailLogs(logs, 400, 24000);
		expect(tail.map((l) => l.sequence)).toEqual([2]);
	});
});

describe("logTextOf", () => {
	it("prefixes stage names", () => {
		expect(logTextOf([line(1, "boom")])).toBe("[build] boom");
	});

	it("never returns an empty string", () => {
		expect(logTextOf([]).trim().length).toBeGreaterThan(0);
	});
});

describe("failureReasonOf", () => {
	it("falls back to a placeholder", () => {
		expect(failureReasonOf("boom")).toBe("boom");
		expect(failureReasonOf(null).trim().length).toBeGreaterThan(0);
		expect(failureReasonOf("  ").trim().length).toBeGreaterThan(0);
	});
});
