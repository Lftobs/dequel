import { describe, expect, it } from "bun:test";
import { createFixer, createInvestigator } from "../agent-def";

const ctx = { progressPath: "/tmp/progress.jsonl", projectRoot: "/srv/project-src", dequelRef: "v0.0.0" };

describe("agent construction", () => {
	it("builds the investigator and fixer without throwing", () => {
		expect(() => createInvestigator(ctx)).not.toThrow();
		expect(() => createFixer(ctx)).not.toThrow();
	});
});
