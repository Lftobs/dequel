import { describe, expect, test } from "bun:test";
import { buildComposeEnvOverrideYaml } from "../compose-env";

describe("buildComposeEnvOverrideYaml", () => {
	test("returns empty string when no env vars", () => {
		expect(buildComposeEnvOverrideYaml(["web"], {})).toBe("");
	});

	test("returns empty string when no services", () => {
		expect(buildComposeEnvOverrideYaml([], { FOO: "bar" })).toBe("");
	});

	test("injects env vars into every service", () => {
		const yaml = buildComposeEnvOverrideYaml(["web", "worker"], { FOO: "bar" });
		expect(yaml).toContain('  web:\n    environment:\n      FOO: "bar"\n');
		expect(yaml).toContain('  worker:\n    environment:\n      FOO: "bar"\n');
	});

	test("skips blank service names", () => {
		const yaml = buildComposeEnvOverrideYaml(["web", "  ", ""], { FOO: "bar" });
		expect((yaml.match(/environment:/g) ?? []).length).toBe(1);
	});

	test("pushes empty string for blank values", () => {
		const yaml = buildComposeEnvOverrideYaml(["web"], { EMPTY: "" });
		expect(yaml).toContain('      EMPTY: ""');
	});

	test("escapes literal dollar signs for compose interpolation", () => {
		const yaml = buildComposeEnvOverrideYaml(["web"], { TOKEN: "adm$GITHUB" });
		expect(yaml).toContain('TOKEN: "adm$$GITHUB"');
	});

	test("escapes plain dollar signs", () => {
		const yaml = buildComposeEnvOverrideYaml(["web"], { PASS: "pa$$w0rd" });
		expect(yaml).toContain('PASS: "pa$$$$w0rd"');
	});
});
