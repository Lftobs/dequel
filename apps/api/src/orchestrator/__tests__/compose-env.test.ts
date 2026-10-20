import { describe, expect, test } from "bun:test";
import { buildComposeScopedOverrideYaml, splitEnvByScope } from "../compose-env";

describe("splitEnvByScope", () => {
	test("splits runtime and build rows", () => {
		const { runtime, build } = splitEnvByScope([
			{ key: "A", value: "1", scope: "runtime" },
			{ key: "B", value: "2", scope: "build" },
			{ key: "C", value: "3", scope: "both" },
			{ key: "D", value: "4" },
		]);
		expect(runtime).toEqual([
			["A", "1"],
			["C", "3"],
			["D", "4"],
		]);
		expect(build).toEqual([
			["B", "2"],
			["C", "3"],
			["D", "4"],
		]);
	});
});

describe("buildComposeScopedOverrideYaml", () => {
	test("returns empty string when no rows", () => {
		expect(buildComposeScopedOverrideYaml(["web"], ["web"], [])).toBe("");
	});

	test("returns empty string when no services", () => {
		expect(buildComposeScopedOverrideYaml([], ["web"], [{ key: "FOO", value: "bar" }])).toBe("");
	});

	test("injects runtime env vars into every service", () => {
		const yaml = buildComposeScopedOverrideYaml(
			["web", "worker"],
			[],
			[{ key: "FOO", value: "bar", scope: "runtime" }],
		);
		expect(yaml).toContain('  web:\n    environment:\n      FOO: "bar"\n');
		expect(yaml).toContain('  worker:\n    environment:\n      FOO: "bar"\n');
	});

	test("adds build args only to build-capable services", () => {
		const yaml = buildComposeScopedOverrideYaml(
			["web", "worker"],
			["web"],
			[{ key: "TOKEN", value: "t", scope: "build" }],
		);
		expect(yaml).toContain("  web:");
		expect(yaml).toContain('    build:\n      args:\n        TOKEN: "t"');
		expect(yaml).not.toContain("  worker:");
	});

	test("emits both sections on a build-capable service", () => {
		const yaml = buildComposeScopedOverrideYaml(
			["web"],
			["web"],
			[
				{ key: "RUN", value: "r", scope: "runtime" },
				{ key: "ARG", value: "a", scope: "build" },
			],
		);
		expect(yaml).toContain('    environment:\n      RUN: "r"');
		expect(yaml).toContain('    build:\n      args:\n        ARG: "a"');
	});

	test("skips build args on image-only services", () => {
		const yaml = buildComposeScopedOverrideYaml(["web"], [], [{ key: "TOKEN", value: "t", scope: "build" }]);
		expect(yaml).toBe("");
	});

	test("escapes literal dollar signs for compose interpolation", () => {
		const yaml = buildComposeScopedOverrideYaml(["web"], ["web"], [{ key: "TOKEN", value: "adm$GITHUB" }]);
		expect(yaml).toContain('TOKEN: "adm$$GITHUB"');
	});

	test("escapes doubled dollar signs in values", () => {
		const yaml = buildComposeScopedOverrideYaml(["web"], ["web"], [{ key: "PASS", value: "pa$$w0rd" }]);
		expect(yaml).toContain('PASS: "pa$$$$w0rd"');
	});
});
