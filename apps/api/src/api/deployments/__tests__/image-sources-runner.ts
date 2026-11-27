import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("ioredis", () => ({
	default: class FakeRedis {
		queue: string[] = [];
		on() {
			return this;
		}
		rpush = mock(async (_key: string, ...values: string[]) => {
			this.queue.push(...values);
		});
		blpop = mock(async () => {
			const v = this.queue.shift();
			return v ? ["queue", v] : null;
		});
		lrem = mock(async () => {});
		zadd = mock(async () => {});
		zrem = mock(async () => {});
		zrangebyscore = mock(async () => []);
		quit = mock(async () => {});
	},
}));

mock.module("../../../executors/ssh", () => ({
	sshExecutor: {
		mode: "ssh",
		deploy: mock(async () => ({})),
		cancel: mock(async () => {}),
		destroy: mock(async () => {}),
		rollback: mock(async () => {}),
	},
}));

const { drizzle } = await import("drizzle-orm/node-postgres");
const { setDbProvider } = await import("../../../db/db-provider");
const schema = await import("../../../db/schema");
const { createTestPool, truncateAllTables } = await import("../../../db/test-helper");
const { createProject, createServer, ensureLocalServer, updateServerStatus } = await import("../../../db/repo");
const { deploymentsRoutes } = await import("../index");

let pool: import("pg").Pool;

const postDeployment = (fields: Record<string, string>, archive?: File) => {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	if (archive) form.set("archive", archive);
	return deploymentsRoutes.handle(
		new Request("http://localhost/deployments", {
			method: "POST",
			body: form,
		}),
	);
};

const createConnectedSshServer = async () => {
	const server = await createServer({ name: "remote-node", host: "127.0.0.1", port: 1, mode: "ssh", sshUser: "root" });
	await updateServerStatus(server.id, "connected");
	return server;
};

beforeAll(async () => {
	pool = createTestPool();
	const db = drizzle(pool, { schema });
	setDbProvider(async () => db);
});

beforeEach(async () => {
	await truncateAllTables(pool);
	await ensureLocalServer();
});

afterAll(async () => {
	await truncateAllTables(pool);
	await pool.end();
});

describe("image deployment sources", () => {
	it("accepts image deployments on a connected SSH server when a project is selected", async () => {
		const server = await createConnectedSshServer();
		const project = await createProject({ name: "remote-image", serverId: server.id });

		const res = await postDeployment({
			sourceType: "image",
			imageRef: "nginx:alpine",
			projectId: project.id,
		});

		expect(res.status).toBe(200);
		const json = (await res.json()) as {
			status: string;
			data: { sourceType: string; serverId: string; sourceRef: string };
		};
		expect(json.status).toBe("success");
		expect(json.data.sourceType).toBe("image");
		expect(json.data.sourceRef).toBe("nginx:alpine");
		expect(json.data.serverId).toBe(server.id);
	});

	it("rejects image deployments on remote servers when no project is selected", async () => {
		await createConnectedSshServer();

		const res = await postDeployment({ sourceType: "image", imageRef: "nginx:alpine" });

		expect(res.status).toBe(400);
		const json = (await res.json()) as { message: string };
		expect(json.message).toBe("Remote image deployments require a project");
	});

	it("rejects image deployments for Compose projects", async () => {
		const project = await createProject({ name: "compose-project", serverId: "local", buildType: "compose" });

		const res = await postDeployment({
			sourceType: "image",
			imageRef: "nginx:alpine",
			projectId: project.id,
		});

		expect(res.status).toBe(400);
		const json = (await res.json()) as { message: string };
		expect(json.message).toBe("Image deployments are not supported for Compose projects");
	});

	it("still rejects archive uploads to remote servers", async () => {
		const server = await createConnectedSshServer();
		const project = await createProject({ name: "remote-upload", serverId: server.id });

		const res = await postDeployment(
			{ sourceType: "upload", projectId: project.id },
			new File(["zip-bytes"], "app.zip"),
		);

		expect(res.status).toBe(400);
		const json = (await res.json()) as { message: string };
		expect(json.message).toBe("Remote servers currently support Git deployments only");
	});

	it("keeps local image deployments working", async () => {
		const res = await postDeployment({ sourceType: "image", imageRef: "nginx:alpine" });

		expect(res.status).toBe(200);
		const json = (await res.json()) as { data: { sourceType: string; serverId: string } };
		expect(json.data.sourceType).toBe("image");
		expect(json.data.serverId).toBe("local");
	});
});
