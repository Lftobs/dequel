import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { createZipStore } from "../../../utils/zip-store";

describe("project compose management", () => {
	it("creates a zip store containing docker-compose.yml and unzips correctly", async () => {
		const tempDir = mkdtempSync(join(process.cwd(), "scratch-compose-test-"));
		try {
			const composeContent = "services:\n  app:\n    image: nginx:alpine\n    ports:\n      - 80:80\n";
			const zipBytes = createZipStore([{ name: "docker-compose.yml", content: composeContent }]);
			const zipPath = join(tempDir, "compose.zip");
			writeFileSync(zipPath, zipBytes);

			const { safeSpawn } = await import("../../../utils/process-exec");
			const res = await safeSpawn("unzip", ["-p", zipPath, "docker-compose.yml"]);
			expect(res.code).toBe(0);
			expect(res.stdout).toBe(composeContent.trim());

			const parsed = parseYaml(res.stdout) as any;
			expect(parsed.services.app.image).toBe("nginx:alpine");
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("validates compose yaml structure", () => {
		const invalidYaml = "services: [bad yaml";
		expect(() => parseYaml(invalidYaml)).toThrow();

		const validYaml = "services:\n  web:\n    image: node:20-alpine\n    ports:\n      - 3000:3000\n";
		const parsed = parseYaml(validYaml) as any;
		expect(parsed.services).toBeDefined();
		expect(parsed.services.web).toBeDefined();
	});

	it("finds matching template for a project and recovers full compose yaml with version 3.8", async () => {
		const { findTemplateForProject, getOrRecoverProjectCompose } = await import("../compose");
		const wpProject = {
			id: "proj-wp-test",
			name: "my-wordpress",
			description: "Content management system (template: wordpress)",
			composeService: "wordpress",
			composePort: 80,
		};
		const template = findTemplateForProject(wpProject);
		expect(template).toBeDefined();
		expect(template?.key).toBe("wordpress");

		const recovered = await getOrRecoverProjectCompose(wpProject);
		expect(recovered).toContain('version: "3.8"');
		expect(recovered).toContain("services:");
		expect(recovered).toContain("wordpress:");
		expect(recovered).toContain("db:");
		expect(recovered).toContain("wp-content:");
		expect(recovered).toContain("wp-db:");
	});
});
