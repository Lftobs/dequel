import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import type { Pool } from "pg";
import { activateDeployment, createDeployment, getDeploymentById, updateDeploymentStatus } from "../repo/deployments";
import { createProject } from "../repo/projects";
import { ensureLocalServer } from "../repo/servers";
import { setupTestDb, teardownTestDb, truncateAllTables } from "../test-helper";

describe("activateDeployment", () => {
	let pool: Pool;
	let projectId: string;

	beforeAll(async () => {
		const res = await setupTestDb();
		pool = res.pool;
	});

	beforeEach(async () => {
		await truncateAllTables(pool);
		await ensureLocalServer();
		const project = await createProject({ name: "activate-proj", serverId: "local" });
		projectId = project.id;
	});

	afterAll(async () => {
		await teardownTestDb(pool);
	});

	const newDeployment = () =>
		createDeployment({
			projectId,
			serverId: "local",
			sourceType: "image",
			sourceRef: "nginx:alpine",
		});

	it("activates a pending deployment with the release patch", async () => {
		const deployment = await newDeployment();
		const ok = await activateDeployment(deployment.id, {
			containerName: "activate-proj-abc12345",
			liveUrl: "http://activate-proj.localhost",
			failureReason: null,
		});
		expect(ok).toBe(true);
		const row = await getDeploymentById(deployment.id);
		expect(row?.status).toBe("running");
		expect(row?.containerName).toBe("activate-proj-abc12345");
		expect(row?.liveUrl).toBe("http://activate-proj.localhost");
		expect(row?.finishedAt).toBeTruthy();
	});

	it("refuses to activate a cancelled deployment", async () => {
		const deployment = await newDeployment();
		await updateDeploymentStatus(deployment.id, "failed", {
			failureReason: "Cancelled because a newer deployment was queued",
		});
		const ok = await activateDeployment(deployment.id, {
			containerName: "should-not-stick",
			failureReason: null,
		});
		expect(ok).toBe(false);
		const row = await getDeploymentById(deployment.id);
		expect(row?.status).toBe("failed");
		expect(row?.containerName).toBeNull();
		expect(row?.failureReason).toBe("Cancelled because a newer deployment was queued");
	});

	it("refuses to activate a superseded deployment", async () => {
		const deployment = await newDeployment();
		await updateDeploymentStatus(deployment.id, "inactive", {
			failureReason: "Superseded by new deployment",
		});
		const ok = await activateDeployment(deployment.id, { failureReason: null });
		expect(ok).toBe(false);
		const row = await getDeploymentById(deployment.id);
		expect(row?.status).toBe("inactive");
		expect(row?.failureReason).toBe("Superseded by new deployment");
	});

	it("activates a building deployment", async () => {
		const deployment = await newDeployment();
		await updateDeploymentStatus(deployment.id, "building");
		const ok = await activateDeployment(deployment.id, { containerName: "built-container" });
		expect(ok).toBe(true);
		const row = await getDeploymentById(deployment.id);
		expect(row?.status).toBe("running");
		expect(row?.containerName).toBe("built-container");
	});
});
