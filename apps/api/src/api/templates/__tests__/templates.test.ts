import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { createZipStore } from "../../../utils/zip-store";
import { getTemplate, listTemplates, renderCompose } from "../registry";
import type { DeployTemplate } from "../types";

describe("deploy template registry", () => {
	it("lists templates with unique keys, services and ports", () => {
		const templates = listTemplates();
		expect(templates.length).toBeGreaterThanOrEqual(11);
		expect(new Set(templates.map((t) => t.key)).size).toBe(templates.length);
		for (const t of templates) {
			expect(t.service.length).toBeGreaterThan(0);
			expect(t.port).toBeGreaterThan(0);
			expect(t.compose).toContain(t.service);
			expect(t.vars.every((v) => /^[A-Z][A-Z0-9_]*$/.test(v.key))).toBe(true);
		}
	});

	it("renders env references into the compose file", () => {
		const template = getTemplate("wordpress");
		expect(template).toBeDefined();
		const { compose, vars } = renderCompose(template!, {
			MYSQL_DATABASE: "wpdata",
			MYSQL_USER: "wp-user",
			MYSQL_ROOT_PASSWORD: "root-secret",
			MYSQL_PASSWORD: "app-secret",
		});
		expect(compose).toContain(`MYSQL_DATABASE=\${MYSQL_DATABASE}`);
		expect(compose).toContain(`MYSQL_USER=\${MYSQL_USER}`);
		expect(compose).toContain(`MYSQL_ROOT_PASSWORD=\${MYSQL_ROOT_PASSWORD}`);
		expect(compose).toContain(`MYSQL_PASSWORD=\${MYSQL_PASSWORD}`);
		expect(compose).not.toContain("wpdata");
		expect(vars.map((v) => [v.key, v.value])).toContainEqual(["MYSQL_DATABASE", "wpdata"]);
		expect(compose).not.toMatch(/(?<!\$)\{[A-Z][A-Z0-9_]*\}/);
	});

	it("generates secrets for vars without defaults", () => {
		const template = getTemplate("n8n");
		expect(template).toBeDefined();
		const first = renderCompose(template!, {});
		expect(first.vars.find((v) => v.key === "N8N_ENCRYPTION_KEY")?.value.length).toBeGreaterThan(0);
		const second = renderCompose(template!, {});
		expect(first.vars.find((v) => v.key === "N8N_ENCRYPTION_KEY")?.value).not.toEqual(
			second.vars.find((v) => v.key === "N8N_ENCRYPTION_KEY")?.value,
		);
		expect(first.compose).toContain(`N8N_ENCRYPTION_KEY=\${N8N_ENCRYPTION_KEY}`);
	});

	it("renders with defaults into parseable compose with the primary service", () => {
		for (const template of listTemplates()) {
			const { compose } = renderCompose(template, {});
			const doc = parseYaml(compose) as { services?: Record<string, unknown> };
			expect(doc?.services).toBeDefined();
			expect(Object.keys(doc.services)).toContain(template.service);
		}
	});

	it("uses provided values over defaults", () => {
		const template = getTemplate("n8n")!;
		const { compose, vars } = renderCompose(template, { GENERIC_TIMEZONE: "Europe/Berlin" });
		expect(vars.find((v) => v.key === "GENERIC_TIMEZONE")?.value).toBe("Europe/Berlin");
		expect(compose).toContain(`GENERIC_TIMEZONE=\${GENERIC_TIMEZONE}`);
	});

	it("rejects unresolved references and line breaks in values", () => {
		const fake: DeployTemplate = {
			key: "fake",
			name: "fake",
			description: "",
			category: "",
			service: "svc",
			port: 80,
			compose: "services:\n  svc:\n    image: alpine\n    port: {MYSTERY_VAR}\n",
			vars: [],
		};
		expect(() => renderCompose(fake, {})).toThrow(/MYSTERY_VAR/);

		const oneVar: DeployTemplate = { ...fake, compose: "value: {ONLY_VAR}\n", vars: [{ key: "ONLY_VAR", label: "v" }] };
		expect(() => renderCompose(oneVar, { ONLY_VAR: "line\nbreak" })).toThrow(/line breaks/i);
	});
});

describe("zip store writer", () => {
	it("produces an archive the platform extractor can read", () => {
		const dir = mkdtempSync(join(tmpdir(), "dequel-zip-"));
		try {
			const compose = "services:\n  svc:\n    image: alpine\n";
			const zip = createZipStore([
				{ name: "docker-compose.yml", content: compose },
				{ name: "README.md", content: "hello world" },
			]);
			const zipPath = join(dir, "template.zip");
			writeFileSync(zipPath, zip);
			const out = join(dir, "out");
			mkdirSync(out, { recursive: true });

			const proc = Bun.spawnSync(["unzip", "-q", zipPath, "-d", out]);
			expect(proc.exitCode).toBe(0);

			expect(readFileSync(join(out, "docker-compose.yml"), "utf8")).toBe(compose);
			expect(readFileSync(join(out, "README.md"), "utf8")).toBe("hello world");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
