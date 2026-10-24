import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { rewriteVolumesForProject, stableVolumeName } from "../../orchestrator/compose-deploy";

describe("compose stable volume rewrite", () => {
	it("declares stable per-project volume names and keeps references aligned", async () => {
		const compose = [
			"services:",
			"  db:",
			"    image: mariadb:11",
			"    volumes:",
			"      - wp-db:/var/lib/mysql",
			"      - ./local-folder:/opt/data",
			"      - /run.sock:/var/run.sock",
			"  wordpress:",
			"    image: wordpress:7.1-php8.4-apache",
			"    volumes:",
			"      - wp-content:/var/www/html",
			"      - wp-db:/var/lib/mysql2",
			"volumes:",
			"  wp-db:",
			"  wp-content:",
		].join("\n");
		const dir = mkdtempSync(join("/tmp", "stablerewrite-"));
		const file = join(dir, "docker-compose.yml");
		writeFileSync(file, compose);
		writeFileSync(file, compose);
		const mounts = await rewriteVolumesForProject(file, "proj-1234-abcd");
		const parsed = parseYaml(readFileSync(file, "utf8")) as any;
		expect(parsed.volumes["dq-proj1234abcd-wp-db"]).toBeDefined();
		expect(parsed.volumes["dq-proj1234abcd-wp-db"].name).toBe("dq-proj1234abcd-wp-db");
		expect(parsed.volumes["dq-proj1234abcd-wp-content"]).toBeDefined();
		expect(parsed.volumes["wp-db"]).toBeUndefined();
		expect(mounts).toContainEqual({ volumeKey: "dq-proj1234abcd-wp-db", containerPath: "/var/lib/mysql" });
		expect(mounts).toContainEqual({ volumeKey: "dq-proj1234abcd-wp-db", containerPath: "/var/lib/mysql2" });
		expect(mounts).toContainEqual({ volumeKey: "dq-proj1234abcd-wp-content", containerPath: "/var/www/html" });
		expect(mounts.find((m) => m.containerPath.startsWith("./local-folder"))).toBeUndefined();
		expect(mounts.find((m) => m.containerPath.startsWith("/run.sock"))).toBeUndefined();
		expect(parsed.services.db.volumes).toContain("dq-proj1234abcd-wp-db:/var/lib/mysql");
		expect(parsed.services.wordpress.volumes).toContain("dq-proj1234abcd-wp-db:/var/lib/mysql2");
		expect(parsed.services.wordpress.volumes).toContain("dq-proj1234abcd-wp-content:/var/www/html");
		expect(parsed.services.db.volumes.join("\n")).toContain("./local-folder");
		expect(parsed.services.db.volumes.join("\n")).toContain("/run.sock");
		rmSync(dir, { recursive: true, force: true });
	});

	it("names volumes deterministically per project", async () => {
		expect(stableVolumeName("c424652c-9d1e-4d5f-bc9a-1234567890ab", "wp-db")).toBe("dq-c424652c9d1e4d5fbc9a-wp-db");
		expect(stableVolumeName("a08b4c0d-a208-4fb5-8617-6b43db10c74c", "umami-db")).toBe(
			"dq-a08b4c0da2084fb58617-umami-db",
		);
		expect(stableVolumeName("ddc6a4f2-9a8c-4286-bda1-aa4b3ae989f8", "memos-data")).toBe(
			"dq-ddc6a4f29a8c4286bda1-memos-data",
		);
		expect(stableVolumeName("x", "weird/../key")).toBe("dq-x-weird..key");
	});
});
