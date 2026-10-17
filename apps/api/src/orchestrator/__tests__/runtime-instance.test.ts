import { describe, expect, test } from "bun:test";
import { evaluateInstanceState } from "../runtime";

describe("evaluateInstanceState", () => {
	test("retries when container does not exist yet", () => {
		const verdict = evaluateInstanceState({ exists: false, status: null });
		expect(verdict.action).toBe("retry");
	});

	test("returns when running", () => {
		const verdict = evaluateInstanceState({ exists: true, status: "running" });
		expect(verdict.action).toBe("return");
	});

	test("fatal with logs when exited during initial wait", () => {
		const verdict = evaluateInstanceState({ exists: true, status: "exited", logs: "Error: MODULE_NOT_FOUND" });
		expect(verdict.action).toBe("fatal");
		if (verdict.action === "fatal") expect(verdict.error.message).toContain("MODULE_NOT_FOUND");
	});

	test("fatal with trimmed logs and placeholder when exited without output", () => {
		const verdict = evaluateInstanceState({ exists: true, status: "exited", logs: "\n\n" });
		expect(verdict.action).toBe("fatal");
		if (verdict.action === "fatal") expect(verdict.error.message).toContain("*No logs produced*");
	});

	test("fatal wording differs for stability-phase crash", () => {
		const verdict = evaluateInstanceState({ exists: true, status: "exited", logs: "boom" }, "stability");
		expect(verdict.action).toBe("fatal");
		if (verdict.action === "fatal") expect(verdict.error.message).toContain("crashed shortly after starting");
	});

	test("retries with note while still initializing", () => {
		const verdict = evaluateInstanceState({ exists: true, status: "created" });
		expect(verdict.action).toBe("retry");
		if (verdict.action === "retry") expect(verdict.note).toContain("initializing");
	});

	test("retries on unknown states like restarting", () => {
		const verdict = evaluateInstanceState({ exists: true, status: "restarting" });
		expect(verdict.action).toBe("retry");
		expect(evaluateInstanceState({ exists: true, status: "running" }, "restart").action).toBe("return");
	});
});
