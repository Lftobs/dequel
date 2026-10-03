import { describe, expect, test } from "bun:test";
import { buildSlackMessage } from "../slack-message";

describe("buildSlackMessage", () => {
	const findBlock = (blocks: any[], type: string) => blocks.find((b) => b.type === type);

	test("cpu alert formats threshold and value as percentages", () => {
		const { text, blocks } = buildSlackMessage("cpu", "tabi", 80, 51.6);
		expect(text).toBe("tabi: cpu alert");
		const fields = findBlock(blocks, "section").fields.map((f: any) => f.text);
		expect(fields).toContain("*Type:* cpu");
		expect(fields).toContain("*Threshold:* 80%");
		expect(fields).toContain("*Current:* 51.6%");
	});

	test("memory alert shows percentages for current value and threshold", () => {
		const { blocks } = buildSlackMessage("memory", "tabi", 85, 91.5);
		const fields = findBlock(blocks, "section").fields.map((f: any) => f.text);
		expect(fields).toContain("*Current:* 91.5%");
		expect(fields).toContain("*Threshold:* 85%");
	});

	test("memory containers render as percentages", () => {
		const { blocks } = buildSlackMessage("memory", "tabi", 85, 91.5, {
			containers: [{ name: "tabi-abc", value: 91.5 }],
		});
		const section = blocks.find((b: any) => b.type === "section" && b.text?.text?.includes("tabi-abc"));
		expect(section.text.text).toContain("`tabi-abc` 91.5%");
	});

	test("downtime alert shows service down", () => {
		const { blocks } = buildSlackMessage("downtime", "tabi", null, 1);
		const fields = findBlock(blocks, "section").fields.map((f: any) => f.text);
		expect(fields).toContain("*Type:* downtime");
		expect(fields).toContain("*Threshold:* N/A");
		expect(fields).toContain("*Current:* Service down");
	});

	test("includes per-container values when details present", () => {
		const { blocks } = buildSlackMessage("cpu", "tabi", 80, 51.6, {
			containers: [
				{ name: "tabi-abc", value: 51.6 },
				{ name: "tabi-def", value: 49.2 },
			],
		});
		const section = blocks.find((b: any) => b.type === "section" && b.text?.text?.includes("tabi-abc"));
		expect(section).toBeDefined();
		expect(section.text.text).toContain("`tabi-abc` 51.6%");
		expect(section.text.text).toContain("`tabi-def` 49.2%");
	});

	test("scaling suggestion enable_autoscaling renders title and button", () => {
		const { blocks } = buildSlackMessage("cpu", "tabi", 80, 51.6, {
			scaling: { kind: "enable_autoscaling", url: "https://dequel.example/project/1?tab=scaling" },
		});
		const section = blocks.find((b: any) => b.type === "section" && b.text?.text?.includes("Autoscaling is off"));
		expect(section).toBeDefined();
		expect(section.text.text).toContain("Enable autoscaling");
		const actions = blocks.filter((b: any) => b.type === "actions");
		const cta = actions.flatMap((a: any) => a.elements).find((e: any) => e.text.text === "Set up autoscaling");
		expect(cta).toBeDefined();
		expect(cta.url).toBe("https://dequel.example/project/1?tab=scaling");
	});

	test("scaling suggestion increase_max_replicas shows replica limit and counts", () => {
		const { blocks } = buildSlackMessage("cpu", "tabi", 80, 51.6, {
			scaling: { kind: "increase_max_replicas", current: 3, maxReplicas: 3, url: "https://x/scaling" },
		});
		const section = blocks.find((b: any) => b.text?.text?.includes("Replica limit reached"));
		expect(section.text.text).toContain("(3/3)");
		const cta = blocks
			.filter((b: any) => b.type === "actions")
			.flatMap((a: any) => a.elements)
			.find((e: any) => e.text.text === "Adjust scaling");
		expect(cta).toBeDefined();
	});

	test("projectUrl renders Open project button", () => {
		const { blocks } = buildSlackMessage("cpu", "tabi", 80, 51.6, {
			projectUrl: "https://dequel.example/project/42",
		});
		const btn = blocks
			.filter((b: any) => b.type === "actions")
			.flatMap((a: any) => a.elements)
			.find((e: any) => e.text.text === "Open project");
		expect(btn).toBeDefined();
		expect(btn.url).toBe("https://dequel.example/project/42");
	});

	test("no scaling block and no project button without details", () => {
		const { blocks } = buildSlackMessage("cpu", "tabi", 80, 51.6);
		expect(blocks.filter((b: any) => b.type === "actions")).toHaveLength(0);
		expect(blocks.some((b: any) => b.text?.text?.includes("Autoscaling"))).toBe(false);
		expect(blocks).toHaveLength(2);
	});
});
