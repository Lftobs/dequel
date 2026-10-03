import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { setDbProvider } from "../../db/db-provider";
import * as schema from "../../db/schema";
import { createTestPool, truncateAllTables } from "../../db/test-helper";
import { createDiagRun, finishDiagRun } from "../../db/repo/diag-runs";
import { getDiagAction } from "../../db/repo/diag-actions";
import { createGithubSession, deleteGithubSession } from "../../db/repo/github-sessions";
import { approveFixPr, approveSlackPost } from "../actions";
import * as sandboxHost from "../sandbox-host";
import type { Proposal } from "../types";

mock.restore();

mock.module("../sandbox-host", () => ({
	...sandboxHost,
	ensureSandbox: async () => {
		throw new Error("sandbox unavailable");
	},
}));

let pool: Pool;

const seed = async () => {
	await pool.query(
		`INSERT INTO projects (id, name, source_type, created_at, updated_at)
		 VALUES ('proj-act', 'Act Project', 'git', NOW(), NOW()) ON CONFLICT DO NOTHING`,
	);
	await pool.query(
		`INSERT INTO deployments (id, project_id, source_type, source_ref, status, branch, commit_sha, created_at, updated_at)
		 VALUES ('dep-git-1', 'proj-act', 'git', 'https://github.com/acme/shop.git', 'failed', 'main', 'aaaabbbbcccc', NOW(), NOW()),
		        ('dep-zip-1', 'proj-act', 'upload', '/tmp/nowhere', 'failed', 'main', '', NOW(), NOW()),
		        ('dep-run-1', 'proj-act', 'git', 'https://github.com/acme/shop.git', 'running', 'main', NULL, NOW(), NOW())
		 ON CONFLICT DO NOTHING`,
	);
};

const userReport: Proposal = {
	cause: "user-source",
	userFix: { title: "Fix it", body: "Do the thing", suggestedDiff: "diff --git a/x b/x\n" },
};

const dequelReport: Proposal = {
	cause: "dequel-source",
	dequelReport: { problem: "p", cause: "c", proposedFix: "f" },
};

const doneRun = async (deploymentId: string, commitSha: string, report: Proposal) => {
	const run = await createDiagRun({ deploymentId, commitSha, provider: "groq", model: "m" });
	await finishDiagRun(run.id, "done", report.cause, report, null);
	return run;
};

beforeAll(async () => {
	pool = createTestPool();
	const db = drizzle(pool, { schema });
	setDbProvider(async () => db);
	await truncateAllTables(pool);
	await seed();
	await deleteGithubSession("sess-test").catch(() => {});
	await createGithubSession("sess-test", "tok-test");
});

afterEach(async () => {
	await truncateAllTables(pool);
	await seed();
});

afterAll(async () => {
	try {
		await truncateAllTables(pool);
	} finally {
		await pool.end();
	}
});

describe("approveFixPr guards", () => {
	const cookie = "github_session=sess-test";
	const authed = { validateToken: async () => true };

	it("requires an idempotency key and configured git credentials first", async () => {
		expect(await approveFixPr("nope", "", null)).toMatchObject({ ok: false, status: 400 });
		expect(await approveFixPr("nope", "k-1", null)).toMatchObject({ ok: false, status: 401 });
		expect(await approveFixPr("nope", "k-1", "github_session=missing")).toMatchObject({ ok: false, status: 401 });
		expect(await approveFixPr("nope", "k-unknown-run", cookie, authed)).toMatchObject({ ok: false, status: 404 });
	});

	it("rejects unfinished runs and non-git projects before touching the sandbox", async () => {
		const running = await createDiagRun({
			deploymentId: "dep-git-1",
			commitSha: "aaaabbbbcccc",
			provider: "groq",
			model: "m",
		});
		expect(await approveFixPr(running.id, "k-2", cookie, authed)).toMatchObject({ ok: false, status: 409 });
		const zip = await doneRun("dep-zip-1", "", userReport);
		expect(await approveFixPr(zip.id, "k-zip", cookie, authed)).toMatchObject({ ok: false, status: 409 });
	});

	it("fails cleanly when the sandbox is unavailable", async () => {
		const noPatch = await doneRun("dep-git-1", "aaaabbbbcccc", {
			cause: "user-source",
			userFix: { title: "t", body: "b", suggestedDiff: null },
		});
		expect(await approveFixPr(noPatch.id, "k-nopatch", cookie, authed)).toMatchObject({ ok: false, status: 502 });
	});

	it("rejects stale runs and blocks unauthenticated clicks without side effects", async () => {
		const stale = await doneRun("dep-git-1", "oldsameaning", userReport);
		expect(await approveFixPr(stale.id, "k-stale", cookie, authed)).toMatchObject({ ok: false, status: 409 });
		const fresh = await doneRun("dep-git-1", "aaaabbbbcccc", userReport);
		expect(await approveFixPr(fresh.id, "k-auth", null)).toMatchObject({ ok: false, status: 401 });
		expect(await getDiagAction("k-auth")).toBeNull();
	});

	it("replays the same key and rejects cross-intent reuse", async () => {
		const fresh = await doneRun("dep-git-1", "aaaabbbbcccc", userReport);
		const first = await approveFixPr(fresh.id, "k-replay", null);
		const second = await approveFixPr(fresh.id, "k-replay", null);
		expect(first).toEqual(second);
		expect(await approveSlackPost(fresh.id, "k-replay")).toMatchObject({ ok: false, status: 409 });
	});
});

describe("approveSlackPost guards", () => {
	it("requires a finished dequel-source run and a configured webhook", async () => {
		expect(await approveSlackPost("nope", "s-1")).toMatchObject({ ok: false, status: 404 });
		const user = await doneRun("dep-git-1", "bbbbccccdddd", userReport);
		expect(await approveSlackPost(user.id, "s-2")).toMatchObject({ ok: false, status: 409 });
		const deq = await doneRun("dep-git-1", "aaaabbbbcccc", dequelReport);
		expect(await approveSlackPost(deq.id, "s-3")).toMatchObject({ ok: false, status: 409 });
	});
});
