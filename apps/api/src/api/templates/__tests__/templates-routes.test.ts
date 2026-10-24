import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { setDbProvider } from "../../../db/db-provider";
import { createDeployment } from "../../../db/repo/deployments";
import {
	createEnvironmentVariable,
	getEnvironmentVariablePlaintext,
	listEnvironmentVariables,
} from "../../../db/repo/env-vars";
import { createProject, listProjects } from "../../../db/repo/projects";
import { createServer, ensureLocalServer, getServerById } from "../../../db/repo/servers";
import * as schema from "../../../db/schema";
import { createTestPool, truncateAllTables } from "../../../db/test-helper";
import { createTemplateRoutes } from "../index";

let pool: Pool;
let workspaceRoot: string;
let routes: ReturnType<typeof createTemplateRoutes>;

const repoOverrides = {
	createProject,
	createDeployment,
	createEnvironmentVariable,
	getServerById,
	listProjects,
};

beforeAll(async () => {
	pool = createTestPool();
	const db = drizzle(pool, { schema });
	setDbProvider(async () => db);
	workspaceRoot = mkdtempSync(join(tmpdir(), "dequel-template-routes-"));
	routes = createTemplateRoutes({
		repo: repoOverrides,
		resolveServerId: async () => "local",
		enqueue: () => {},
		workspaceRoot,
	});
});

beforeEach(async () => {
	await truncateAllTables(pool);
	await ensureLocalServer();
});

afterAll(async () => {
	await truncateAllTables(pool);
	await pool.end();
	rmSync(workspaceRoot, { recursive: true, force: true });
});

const postDeploy = (body: Record<string, unknown>) =>
	routes.handle(
		new Request("http://localhost/templates/n8n/deployments", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

describe("template routes", () => {
	it("returns template metadata without raw compose", async () => {
		const res = await routes.handle(new Request("http://localhost/templates"));
		expect(res.status).toBe(200);
		const json = (await res.json()) as { status: string; data: { key: string; service: string; port: number }[] };
		expect(json.status).toBe("success");
		expect(json.data.some((t) => t.key === "n8n")).toBe(true);
		const entry = json.data.find((t) => t.key === "wordpress");
		expect(entry?.service).toBe("wordpress");
		expect(entry?.port).toBe(80);
	});

	it("creates a project, archive and deployment from a template", async () => {
		const res = await postDeploy({
			name: "n8n-check",
			values: { GENERIC_TIMEZONE: "Europe/Berlin" },
		});
		expect(res.status).toBe(200);
		const json = (await res.json()) as {
			status: string;
			data: { project: Record<string, any>; deployment: Record<string, any> };
		};
		expect(json.status).toBe("success");
		expect(json.data.project.buildType).toBe("compose");
		expect(json.data.project.composeService).toBe("n8n");
		expect(json.data.project.composePort).toBe(5678);
		expect(json.data.project.sourceType).toBe("upload");
		expect(json.data.deployment.sourceType).toBe("upload");

		const archivePath = json.data.deployment.sourceRef as string;
		expect(existsSync(archivePath)).toBe(true);

		const out = join(workspaceRoot, "verify-extract");
		mkdirSync(out, { recursive: true });
		const proc = Bun.spawnSync(["unzip", "-q", archivePath, "-d", out]);
		expect(proc.exitCode).toBe(0);
		const compose = readFileSync(join(out, "docker-compose.yml"), "utf8");
		expect(compose).toContain(`GENERIC_TIMEZONE=\${GENERIC_TIMEZONE}`);
		expect(compose).toContain(`N8N_ENCRYPTION_KEY=\${N8N_ENCRYPTION_KEY}`);
		expect(compose).not.toMatch(/(?<!\$)\{[A-Z][A-Z0-9_]*\}/);
	});

	it("persists the created project and deployment", async () => {
		const res = await postDeploy({ name: "n8n-persist" });
		expect(res.status).toBe(200);
		const json = (await res.json()) as { data: { project: { id: string }; deployment: { id: string } } };
		const projects = await listProjects();
		expect(projects.some((p) => p.id === json.data.project.id)).toBe(true);
	});

	it("stores the rendered variables as project env vars", async () => {
		const res = await postDeploy({ name: "n8n-env", values: { GENERIC_TIMEZONE: "Europe/Berlin" } });
		expect(res.status).toBe(200);
		const json = (await res.json()) as { data: { project: { id: string } } };
		const envs = await listEnvironmentVariables(json.data.project.id);
		const keys = envs.map((v) => v.key);
		expect(keys).toContain("GENERIC_TIMEZONE");
		expect(keys).toContain("N8N_ENCRYPTION_KEY");
		const secret = envs.find((v) => v.key === "N8N_ENCRYPTION_KEY");
		expect(secret).toBeDefined();
		const plain = await getEnvironmentVariablePlaintext(secret!.id);
		expect(plain?.length).toBeGreaterThan(0);
	});

	it("rejects duplicate project names", async () => {
		const first = await postDeploy({ name: "n8n-dup" });
		expect(first.status).toBe(200);
		const second = await postDeploy({ name: "n8n-dup" });
		expect(second.status).toBe(400);
		const json = (await second.json()) as { status: string; message: string };
		expect(json.status).toBe("error");
	});

	it("rejects unknown template keys", async () => {
		const res = await routes.handle(
			new Request("http://localhost/templates/nope/deployments", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{}",
			}),
		);
		expect(res.status).toBe(404);
	});

	it("rejects non-local servers", async () => {
		const remoteRoutes = createTemplateRoutes({
			repo: {
				createProject,
				createDeployment,
				getServerById: async () => ({ id: "srv", name: "srv", mode: "ssh" }) as never,
				listProjects,
			},
			resolveServerId: async () => "srv",
			enqueue: () => {},
			workspaceRoot,
		});
		const res = await remoteRoutes.handle(
			new Request("http://localhost/templates/n8n/deployments", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "n8n-remote" }),
			}),
		);
		expect(res.status).toBe(400);
		const json = (await res.json()) as { message: string };
		expect(json.message).toContain("remote servers support Git sources only");
	});

	it("deploys to an explicitly selected local server", async () => {
		const res = await postDeploy({ name: "n8n-pick", serverId: "local" });
		expect(res.status).toBe(200);
		const json = (await res.json()) as { data: { project: { serverId: string | null } } };
		expect(json.data.project.serverId).toBe("local");
	});

	it("rejects an explicitly selected non-local server", async () => {
		const server = await createServer({ name: "edge-box", host: "203.0.113.9", mode: "ssh", sshUser: "deploy" });
		const res = await postDeploy({ name: "n8n-edge", serverId: server.id });
		expect(res.status).toBe(400);
		const json = (await res.json()) as { message: string };
		expect(json.message).toContain("remote servers support Git sources only");
	});

	it("rejects an unknown server id", async () => {
		const res = await postDeploy({ name: "n8n-ghost", serverId: "no-such-server" });
		expect(res.status).toBe(400);
		const json = (await res.json()) as { message: string };
		expect(json.message).toContain("does not exist");
	});
});
