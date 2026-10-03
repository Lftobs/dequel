import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { setDbProvider } from "../db-provider";
import * as schema from "../schema";
import { createTestPool, truncateAllTables } from "../test-helper";

let pool: Pool;

const seed = async () => {
	await pool.query(
		`INSERT INTO projects (id, name, source_type, created_at, updated_at)
		 VALUES ('proj-ev', 'Event Project', 'git', NOW(), NOW()) ON CONFLICT DO NOTHING`,
	);
	await pool.query(
		`INSERT INTO deployments (id, project_id, source_type, source_ref, status, branch, commit_sha, created_at, updated_at)
		 VALUES ('dep-ev-1', 'proj-ev', 'git', 'https://github.com/test/repo.git', 'pending', 'main', 'abc1234567890abcdef', NOW(), NOW()),
		        ('dep-ev-2', 'proj-ev', 'git', 'https://github.com/test/repo.git', 'pending', 'main', NULL, NOW(), NOW())
		 ON CONFLICT DO NOTHING`,
	);
};

beforeAll(async () => {
	pool = createTestPool();
	const db = drizzle(pool, { schema });
	setDbProvider(async () => db);
	await truncateAllTables(pool);
	await seed();
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

const eventsFor = async (deploymentId: string) =>
	(
		await pool.query(`SELECT id, type, message, metadata, sent_at FROM deployment_events WHERE deployment_id = $1`, [
			deploymentId,
		])
	).rows;

const deploymentRow = async (deploymentId: string) =>
	(await pool.query(`SELECT status, failure_reason FROM deployments WHERE id = $1`, [deploymentId])).rows[0];

describe("deployment event backbone", () => {
	it("records a failure exactly once under 5 concurrent calls", async () => {
		const { recordDeploymentFailure } = await import("../repo/deployment-events");
		const results = await Promise.all(
			Array.from({ length: 5 }, () =>
				recordDeploymentFailure({ deploymentId: "dep-ev-1", reason: "build exploded", source: "pipeline" }),
			),
		);

		expect(results.filter((r) => r.claimed)).toHaveLength(1);
		expect(results.filter((r) => r.eventId !== null)).toHaveLength(1);

		const events = await eventsFor("dep-ev-1");
		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("failed");
		expect(events[0].message).toBe("build exploded");

		const dep = await deploymentRow("dep-ev-1");
		expect(dep.status).toBe("failed");
		expect(dep.failure_reason).toBe("build exploded");
	});

	it("keeps the first terminal event across failed -> pending -> failed", async () => {
		const { recordDeploymentFailure } = await import("../repo/deployment-events");
		const { updateDeploymentStatus } = await import("../repo/deployments");

		const first = await recordDeploymentFailure({
			deploymentId: "dep-ev-1",
			reason: "first failure",
			source: "pipeline",
		});
		expect(first.claimed).toBe(true);

		await updateDeploymentStatus("dep-ev-1", "pending");

		const second = await recordDeploymentFailure({
			deploymentId: "dep-ev-1",
			reason: "second failure",
			source: "ssh",
		});
		expect(second.claimed).toBe(false);

		const events = await eventsFor("dep-ev-1");
		expect(events).toHaveLength(1);
		expect(events[0].message).toBe("first failure");
	});

	it("suppresses failure emails when the deployment was cancelled", async () => {
		const { recordDeploymentCancellation, recordDeploymentFailure, listPendingFailureNotificationIds } = await import(
			"../repo/deployment-events"
		);

		const cancel = await recordDeploymentCancellation({
			deploymentId: "dep-ev-1",
			reason: "Cancelled",
			source: "pipeline",
		});
		expect(cancel.claimed).toBe(true);

		const fail = await recordDeploymentFailure({
			deploymentId: "dep-ev-1",
			reason: "late agent error",
			source: "job-channel",
		});
		expect(fail.claimed).toBe(false);

		const events = await eventsFor("dep-ev-1");
		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("cancelled");

		const dep = await deploymentRow("dep-ev-1");
		expect(dep.status).toBe("failed");
		expect(dep.failure_reason).toBe("Cancelled");

		expect(await listPendingFailureNotificationIds()).toHaveLength(0);
	});

	it("does not let the trigger add a failed event after a cancellation", async () => {
		const { recordDeploymentCancellation } = await import("../repo/deployment-events");
		await recordDeploymentCancellation({ deploymentId: "dep-ev-1", reason: "Cancelled", source: "pipeline" });

		await pool.query(`UPDATE deployments SET status = 'pending', failure_reason = NULL WHERE id = 'dep-ev-1'`);
		await pool.query(`UPDATE deployments SET status = 'failed', failure_reason = 'Cancelled' WHERE id = 'dep-ev-1'`);

		const events = await eventsFor("dep-ev-1");
		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("cancelled");
	});

	it("trigger inserts a fallback failed event for raw status writes", async () => {
		await pool.query(
			`UPDATE deployments SET status = 'failed', failure_reason = 'raw write boom' WHERE id = 'dep-ev-2'`,
		);

		const events = await eventsFor("dep-ev-2");
		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("failed");
		expect(events[0].message).toBe("raw write boom");
		expect((events[0].metadata as any)?.source).toBe("status-trigger");
		expect(events[0].sent_at).toBeNull();
	});

	it("claims, marks sent, and stops retrying", async () => {
		const {
			recordDeploymentFailure,
			claimFailureNotification,
			markFailureNotificationSent,
			listPendingFailureNotificationIds,
		} = await import("../repo/deployment-events");

		const { claimed, eventId } = await recordDeploymentFailure({
			deploymentId: "dep-ev-1",
			reason: "mail me",
			source: "pipeline",
		});
		expect(claimed).toBe(true);

		const pending = await listPendingFailureNotificationIds();
		expect(pending).toContain(eventId);

		const ctx = await claimFailureNotification(eventId!);
		expect(ctx).not.toBeNull();
		expect(ctx!.deploymentId).toBe("dep-ev-1");
		expect(ctx!.projectName).toBe("Event Project");
		expect(ctx!.failureReason).toBe("mail me");
		expect(ctx!.commitSha).toBe("abc1234567890abcdef");
		expect(ctx!.attempt).toBe(1);

		await markFailureNotificationSent(eventId!);
		expect(await claimFailureNotification(eventId!)).toBeNull();
		expect(await listPendingFailureNotificationIds()).not.toContain(eventId);
	});

	it("caps delivery attempts at 3", async () => {
		const { recordDeploymentFailure, claimFailureNotification } = await import("../repo/deployment-events");

		const { eventId } = await recordDeploymentFailure({
			deploymentId: "dep-ev-2",
			reason: "flaky smtp",
			source: "pipeline",
		});

		expect(await claimFailureNotification(eventId!)).not.toBeNull();
		expect(await claimFailureNotification(eventId!)).not.toBeNull();
		expect(await claimFailureNotification(eventId!)).not.toBeNull();
		expect(await claimFailureNotification(eventId!)).toBeNull();
	});
});
