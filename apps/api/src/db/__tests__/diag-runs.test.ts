import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { setDbProvider } from "../db-provider";
import * as schema from "../schema";
import { createTestPool, truncateAllTables } from "../test-helper";
import {
	createDiagRun,
	finishDiagRun,
	getDiagRun,
	getStagePayload,
	listActiveDiagRuns,
	listStageResults,
	markInterruptedDiagRuns,
	recordStageResult,
} from "../repo/diag-runs";

let pool: Pool;

mock.restore();

beforeAll(async () => {
	pool = createTestPool();
	const db = drizzle(pool, { schema });
	setDbProvider(async () => db);
	await truncateAllTables(pool);
	await pool.query(
		`INSERT INTO projects (id, name, source_type, created_at, updated_at)
		 VALUES ('proj-diagruns', 'DiagRuns Project', 'git', NOW(), NOW()) ON CONFLICT DO NOTHING`,
	);
	await pool.query(
		`INSERT INTO deployments (id, project_id, source_type, source_ref, status, created_at, updated_at)
		 VALUES ('dep-x', 'proj-diagruns', 'git', 'https://github.com/test/repo.git', 'failed', NOW(), NOW()),
		        ('dep-dup', 'proj-diagruns', 'git', 'https://github.com/test/repo.git', 'failed', NOW(), NOW())
		 ON CONFLICT DO NOTHING`,
	);
});

afterAll(async () => {
	try {
		await truncateAllTables(pool);
	} finally {
		await pool.end();
	}
});

describe("diag-runs", () => {
	it("creates, finds and finishes runs", async () => {
		const run = await createDiagRun({ deploymentId: "dep-x", commitSha: "abc", provider: "groq", model: "m" });
		expect(run.status).toBe("running");
		expect(run.currentStage).toBeNull();

		await recordStageResult(run.id, "triage", { failingStage: "build" });
		expect(await getStagePayload(run.id, "triage")).toEqual({ failingStage: "build" });

		await recordStageResult(run.id, "triage", { failingStage: "deploy" });
		expect(await getStagePayload(run.id, "triage")).toEqual({ failingStage: "deploy" });
		expect((await listStageResults(run.id)).filter((s) => s.stage === "triage")).toHaveLength(1);

		await finishDiagRun(run.id, "done", "user-source", { cause: "user-source" }, null);
		const done = await getDiagRun(run.id);
		expect(done?.status).toBe("done");
		expect(done?.cause).toBe("user-source");
		expect(done?.report).toEqual({ cause: "user-source" });
	});

	it("rejects duplicate runs for the same deployment and commit", async () => {
		await createDiagRun({ deploymentId: "dep-dup", commitSha: "", provider: "groq", model: "m" });
		await expect(
			createDiagRun({ deploymentId: "dep-dup", commitSha: "", provider: "groq", model: "m" }),
		).rejects.toThrow();
	});

	it("lists active runs and marks interrupted ones as failed", async () => {
		const run = await createDiagRun({ deploymentId: "dep-x", commitSha: "active-1", provider: "ollama", model: "m" });
		const active = await listActiveDiagRuns();
		const found = active.find((r) => r.id === run.id);
		expect(found).toMatchObject({ deploymentId: "dep-x", projectName: "DiagRuns Project", provider: "ollama" });

		expect(await markInterruptedDiagRuns()).toBeGreaterThanOrEqual(1);
		expect((await getDiagRun(run.id))?.status).toBe("error");
		expect(await listActiveDiagRuns()).toEqual([]);
	});
});
