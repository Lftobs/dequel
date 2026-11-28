import { afterAll, afterEach, beforeAll, describe, expect, it, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import type { EnvironmentVariable } from "../../types";
import { setDbProvider } from "../../db/db-provider";
import * as schema from "../../db/schema";
import { createTestPool, truncateAllTables } from "../../db/test-helper";
import { listEnvironmentVariables, listEnvironmentVariablesForDeploy } from "../../db/repo/env-vars";
import {
	ensureComposeVariables,
	findMissingRequired,
	parseComposeBuildServices,
	resolveEnvironmentTemplates,
	scanComposeVariables,
} from "../compose-vars";

const COMPOSE_TEXT = [
	"services:",
	"  api:",
	"    environment:",
	"      DATABASE_URL: ${DATABASE_URL:?}",
	"      LOG_LEVEL: ${LOG_LEVEL:-info}",
	"      REGION: ${REGION}",
	"      TOKEN: ${TOKEN?}",
	"      LEGACY: ${LEGACY-ini}",
	"      ESC: $$ESCAPED",
	"    build:",
	"      args:",
	"        BUILD_TOKEN: ${BUILD_TOKEN:?}",
].join("\n");

let pool: Pool;

beforeAll(async () => {
	pool = createTestPool();
	const db = drizzle(pool, { schema });
	setDbProvider(async () => db);
	await truncateAllTables(pool);
	await pool.query(
		`INSERT INTO projects (id, name, source_type, created_at, updated_at)
		 VALUES ('proj-cv', 'Compose Vars', 'git', NOW(), NOW()) ON CONFLICT DO NOTHING`,
	);
});

afterEach(async () => {
	await pool.query(
		`DELETE FROM environment_variables WHERE project_id = 'proj-cv'; DELETE FROM projects WHERE id = 'proj-cv';
		 INSERT INTO projects (id, name, source_type, created_at, updated_at)
		 VALUES ('proj-cv', 'Compose Vars', 'git', NOW(), NOW()) ON CONFLICT DO NOTHING`,
	);
});

afterAll(async () => {
	try {
		await truncateAllTables(pool);
	} finally {
		await pool.end();
	}
});

describe("scanComposeVariables", () => {
	test("classifies all compose interpolation forms", () => {
		const refs = scanComposeVariables(COMPOSE_TEXT);
		const byKey = new Map(refs.map((r) => [r.key, r]));
		expect(byKey.get("DATABASE_URL")).toEqual({ key: "DATABASE_URL", mode: "required", defaultValue: null });
		expect(byKey.get("LOG_LEVEL")).toEqual({ key: "LOG_LEVEL", mode: "default", defaultValue: "info" });
		expect(byKey.get("REGION")).toEqual({ key: "REGION", mode: "plain", defaultValue: null });
		expect(byKey.get("TOKEN")).toEqual({ key: "TOKEN", mode: "requiredSet", defaultValue: null });
		expect(byKey.get("LEGACY")).toEqual({ key: "LEGACY", mode: "defaultUnset", defaultValue: "ini" });
		expect(byKey.get("BUILD_TOKEN")).toEqual({ key: "BUILD_TOKEN", mode: "required", defaultValue: null });
	});

	test("skips escaped dollar signs", () => {
		const refs = scanComposeVariables("ESCAPE: $$NOT_A_REF\nREAL: ${REAL_ONE}");
		expect(refs.map((r) => r.key)).toEqual(["REAL_ONE"]);
	});

	test("upgrades mixed-mode references to the strictest semantics", () => {
		const refs = scanComposeVariables("A: ${X:-fallback}\nB: ${X:?}");
		expect(refs).toEqual([{ key: "X", mode: "required", defaultValue: null }]);
	});
});

describe("resolveEnvironmentTemplates", () => {
	test("rewrites Coolify-style templates to compose interpolation", () => {
		expect(resolveEnvironmentTemplates("A: {{environment.DATABASE_URL}}\nB: {{environment.JWT}}")).toBe(
			"A: ${DATABASE_URL}\nB: ${JWT}",
		);
	});

	test("leaves plain text untouched", () => {
		expect(resolveEnvironmentTemplates("unchanged")).toBe("unchanged");
	});
});

describe("findMissingRequired", () => {
	test("blocks missing and empty values for required, missing-only for requiredSet", () => {
		const refs = scanComposeVariables(COMPOSE_TEXT);
		const envMap: Record<string, string> = { DATABASE_URL: "", TOKEN: "", LEGACY: "" };
		expect(findMissingRequired(refs, envMap)).toEqual(["DATABASE_URL", "BUILD_TOKEN"]);
	});

	test("passes when every required variable has a value", () => {
		const refs = scanComposeVariables(COMPOSE_TEXT);
		const envMap: Record<string, string> = {
			DATABASE_URL: "x",
			BUILD_TOKEN: "y",
			TOKEN: "",
			LOG_LEVEL: "",
			REGION: "",
			LEGACY: "",
		};
		expect(findMissingRequired(refs, envMap)).toEqual([]);
	});
});

describe("parseComposeBuildServices", () => {
	test("returns services that declare a build section", async () => {
		const dir = await mkdtemp(join(tmpdir(), "dequel-compose-"));
		try {
			const file = join(dir, "docker-compose.yml");
			await writeFile(file, "services:\n  web:\n    build: .\n  worker:\n    image: busybox\n", "utf8");
			expect(await parseComposeBuildServices(file)).toEqual(["web"]);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});

const setupWorkspace = async (text: string): Promise<string> => {
	const dir = await mkdtemp(join(tmpdir(), "dequel-preflight-"));
	await writeFile(join(dir, "docker-compose.yml"), text, "utf8");
	return dir;
};

describe("ensureComposeVariables", () => {
	it("seeds compose-defined variables and blocks until required values are set", async () => {
		const dir = await setupWorkspace(COMPOSE_TEXT);
		try {
			const created: EnvironmentVariable[] = await listEnvironmentVariables("proj-cv", "production");
			expect(created).toHaveLength(0);
			await expect(
				ensureComposeVariables({
					workspacePath: dir,
					projectId: "proj-cv",
					environment: "production",
					providedRows: [{ key: "DATABASE_URL", value: "postgres://db", scope: "both" }],
					onLog: async () => {},
				}),
			).rejects.toThrow(/BUILD_TOKEN/);
			const rows = await listEnvironmentVariablesForDeploy("proj-cv", "production");
			const byKey = new Map(rows.map((r) => [r.key, r]));
			expect(byKey.get("LOG_LEVEL")?.value).toBe("info");
			expect(byKey.get("TOKEN")).toBeDefined();
			expect(byKey.get("REGION")).toBeDefined();
			expect(byKey.get("BUILD_TOKEN")).toBeDefined();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("blocks the build when a required variable has no value", async () => {
		const dir = await setupWorkspace(COMPOSE_TEXT);
		try {
			await expect(
				ensureComposeVariables({
					workspacePath: dir,
					projectId: "proj-cv",
					environment: "production",
					providedRows: [],
					onLog: async () => {},
				}),
			).rejects.toThrow(/Missing required env variables: DATABASE_URL, BUILD_TOKEN/);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("passes once required variables hold values and rewrites templates", async () => {
		const compose = [
			"services:",
			"  api:",
			"    environment:",
			"      NEED: ${NEED:?}",
			"      SHARED: {{environment.NEED}}",
		].join("\n");
		const dir = await setupWorkspace(compose);
		try {
			const envMap = await ensureComposeVariables({
				workspacePath: dir,
				projectId: "proj-cv",
				environment: "production",
				providedRows: [{ key: "NEED", value: "provided", scope: "both" }],
				onLog: async () => {},
			});
			expect(envMap.NEED).toBe("provided");
			const text = await readFile(join(dir, "docker-compose.yml"), "utf8");
			expect(text).toContain("SHARED: ${NEED}");
			expect(text).not.toContain("{{environment.");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("does not overwrite existing values when re-seeding", async () => {
		const dir = await setupWorkspace(COMPOSE_TEXT);
		try {
			await ensureComposeVariables({
				workspacePath: dir,
				projectId: "proj-cv",
				environment: "production",
				providedRows: [
					{ key: "DATABASE_URL", value: "postgres://db", scope: "both" },
					{ key: "BUILD_TOKEN", value: "tok", scope: "both" },
				],
				onLog: async () => {},
			});
			const rows = await listEnvironmentVariables("proj-cv", "production");
			const byKey = new Map(rows.map((r) => [r.key, r]));
			expect(byKey.get("DATABASE_URL")).toBeDefined();
			expect(byKey.get("BUILD_TOKEN")).toBeDefined();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
