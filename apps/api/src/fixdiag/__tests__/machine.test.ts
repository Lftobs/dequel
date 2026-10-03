import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { setDbProvider } from "../../db/db-provider";
import * as schema from "../../db/schema";
import { createTestPool, truncateAllTables } from "../../db/test-helper";
import { upsertLlmKey } from "../../db/repo/llm-keys";
import { getDiagRun, listStageResults, recordStageResult } from "../../db/repo/diag-runs";
import { DiagRunMachine, parseGithubRepo } from "../machine";
import { diagBus } from "../stream";
import type { FixdiagPrograms, InvestigateFn, Investigation, StageEvent } from "../types";

mock.restore();

let pool: Pool;

const seed = async () => {
	await pool.query(
		`INSERT INTO projects (id, name, source_type, created_at, updated_at)
		 VALUES ('proj-diag', 'Diag Project', 'git', NOW(), NOW()) ON CONFLICT DO NOTHING`,
	);
	await pool.query(
		`INSERT INTO deployments (id, project_id, source_type, source_ref, status, branch, commit_sha, failure_reason, created_at, updated_at)
		 VALUES ('dep-failed-1', 'proj-diag', 'upload', '/tmp/does-not-exist', 'failed', 'main', 'deadbeef', 'boom', NOW(), NOW()),
		        ('dep-running-1', 'proj-diag', 'upload', '/tmp/does-not-exist', 'running', 'main', NULL, NULL, NOW(), NOW())
		 ON CONFLICT DO NOTHING`,
	);
	await pool.query(
		`INSERT INTO deployment_logs (deployment_id, sequence, stage, message)
		 VALUES ('dep-failed-1', 1, 'build', 'Step 1/2'), ('dep-failed-1', 2, 'build', 'boom') ON CONFLICT DO NOTHING`,
	);
};

const fakePrograms: FixdiagPrograms = {
	triageLogs: async () => ({ failingStage: "build", signalLines: ["boom"], confidence: "high" }),
	explainFix: async () => ({ summary: "s", fixSteps: ["do x"], patchHint: null }),
	draftProposal: async () => ({ cause: "user-source", userFix: { title: "t", body: "b", suggestedDiff: null } }),
};

const fakeInvestigation: Investigation = {
	cause: "user-source",
	culpritPaths: ["Dockerfile"],
	rationale: "r",
	keyEvidence: ["boom"],
	dequelRev: "v0.3.0 @ abc1234",
	dequelStale: false,
};

const fakeInvestigator: InvestigateFn = async () => fakeInvestigation;

beforeAll(async () => {
	pool = createTestPool();
	const db = drizzle(pool, { schema });
	setDbProvider(async () => db);
	await truncateAllTables(pool);
	await seed();
	await upsertLlmKey({ provider: "groq", apiKey: "gsk-test" });
});

afterEach(async () => {
	await truncateAllTables(pool);
	await seed();
	await upsertLlmKey({ provider: "groq", apiKey: "gsk-test" });
});

afterAll(async () => {
	try {
		await truncateAllTables(pool);
	} finally {
		await pool.end();
	}
});

describe("DiagRunMachine.start", () => {
	it("rejects unknown deployments, non-failed deployments and bad input", async () => {
		expect(await DiagRunMachine.start({ deploymentId: "nope", provider: "groq", model: "m" })).toMatchObject({
			ok: false,
			status: 404,
		});
		expect(await DiagRunMachine.start({ deploymentId: "dep-running-1", provider: "groq", model: "m" })).toMatchObject({
			ok: false,
			status: 409,
		});
		expect(await DiagRunMachine.start({ deploymentId: "dep-failed-1", provider: "nope", model: "m" })).toMatchObject({
			ok: false,
			status: 400,
		});
		expect(await DiagRunMachine.start({ deploymentId: "dep-failed-1", provider: "groq", model: " " })).toMatchObject({
			ok: false,
			status: 400,
		});
		expect(await DiagRunMachine.start({ deploymentId: "dep-failed-1", provider: "openai", model: "m" })).toMatchObject({
			ok: false,
			status: 400,
		});
	});

	it("creates once and returns the existing run on repeat", async () => {
		const first = await DiagRunMachine.start({ deploymentId: "dep-failed-1", provider: "groq", model: "m" });
		expect(first.ok && first.created).toBe(true);
		const second = await DiagRunMachine.start({ deploymentId: "dep-failed-1", provider: "groq", model: "m" });
		expect(second.ok && !second.created && second.run.id === (first.ok && first.run.id)).toBe(true);
	});
});

describe("DiagRunMachine.drive", () => {
	it("runs all stages, persists the report and emits events", async () => {
		const started = await DiagRunMachine.start({ deploymentId: "dep-failed-1", provider: "groq", model: "m" });
		if (!started.ok) throw new Error("start failed");
		const events: StageEvent[] = [];
		const unsub = diagBus.subscribe(started.run.id, (e) => events.push(e));
		try {
			await DiagRunMachine.drive(started.run.id, fakePrograms, fakeInvestigator);
		} finally {
			unsub();
		}
		const run = await getDiagRun(started.run.id);
		expect(run?.status).toBe("done");
		expect(run?.cause).toBe("user-source");
		expect(run?.report).toEqual({ cause: "user-source", userFix: { title: "t", body: "b", suggestedDiff: null } });
		expect((await listStageResults(started.run.id)).map((s) => s.stage)).toEqual([
			"triage",
			"investigate",
			"explain",
			"propose",
		]);
		expect(events.filter((e) => e.type === "stage")).toHaveLength(4);
		expect(events.some((e) => e.type === "done")).toBe(true);
	});

	it("resumes after the last completed stage", async () => {
		const started = await DiagRunMachine.start({ deploymentId: "dep-failed-1", provider: "groq", model: "m" });
		if (!started.ok) throw new Error("start failed");
		await recordStageResult(started.run.id, "triage", { failingStage: "build", signalLines: [], confidence: "high" });
		const calls: string[] = [];
		const counting: FixdiagPrograms = {
			triageLogs: async (...args) => {
				calls.push("triage");
				return fakePrograms.triageLogs(...args);
			},
			explainFix: async (...args) => {
				calls.push("explain");
				return fakePrograms.explainFix(...args);
			},
			draftProposal: async (...args) => {
				calls.push("propose");
				return fakePrograms.draftProposal(...args);
			},
		};
		const investigator: InvestigateFn = async (...args) => {
			calls.push("investigate");
			return fakeInvestigator(...args);
		};
		await DiagRunMachine.drive(started.run.id, counting, investigator);
		expect(calls).toEqual(["investigate", "explain", "propose"]);
		expect((await getDiagRun(started.run.id))?.status).toBe("done");
	});

	it("marks the run errored when the investigator throws", async () => {
		const started = await DiagRunMachine.start({ deploymentId: "dep-failed-1", provider: "groq", model: "m" });
		if (!started.ok) throw new Error("start failed");
		const failing: InvestigateFn = async () => Promise.reject(new Error("sandbox down"));
		const events: StageEvent[] = [];
		const unsub = diagBus.subscribe(started.run.id, (e) => events.push(e));
		try {
			await DiagRunMachine.drive(started.run.id, fakePrograms, failing);
		} finally {
			unsub();
		}
		const run = await getDiagRun(started.run.id);
		expect(run?.status).toBe("error");
		expect(run?.error).toBe("investigate failed: sandbox down");
		expect(events.some((e) => e.type === "error")).toBe(true);
	});

	it("auto-posts dequel-source reports to Slack without failing the run", async () => {
		const started = await DiagRunMachine.start({ deploymentId: "dep-failed-1", provider: "groq", model: "m" });
		if (!started.ok) throw new Error("start failed");
		const dequelPrograms: FixdiagPrograms = {
			...fakePrograms,
			draftProposal: async () => ({
				cause: "dequel-source",
				dequelReport: { problem: "p", cause: "c", proposedFix: "f" },
			}),
		};
		await DiagRunMachine.drive(started.run.id, dequelPrograms, fakeInvestigator);
		const run = await getDiagRun(started.run.id);
		expect(run?.status).toBe("done");
		expect(run?.cause).toBe("dequel-source");
		const { rows } = await pool.query("SELECT status FROM diag_actions WHERE run_id = $1 AND kind = 'slack'", [
			started.run.id,
		]);
		expect(rows.length).toBe(1);
	});
});

describe("parseGithubRepo", () => {
	it("parses https and ssh urls", () => {
		expect(parseGithubRepo("https://github.com/acme/shop.git", "main")).toEqual({
			owner: "acme",
			repo: "shop",
			base: "main",
		});
		expect(parseGithubRepo("git@github.com:acme/shop.git", null)).toEqual({
			owner: "acme",
			repo: "shop",
			base: "main",
		});
		expect(parseGithubRepo("https://example.com/acme/shop", "dev")).toBeNull();
	});
});
