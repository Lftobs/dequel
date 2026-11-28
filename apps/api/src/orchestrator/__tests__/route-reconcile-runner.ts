import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Pool } from "pg";

const routesDir = mkdtempSync(join(tmpdir(), "dequl-route-reconcile-"));
process.env.CADDY_ROUTES_DIR = routesDir;

const { drizzle } = await import("drizzle-orm/node-postgres");
const { setDbProvider } = await import("../../db/db-provider");
const { createDomain, createDeployment, createProject, listRoutesByDeployment, updateDeploymentStatus } = await import(
	"../../db/repo"
);
const schema = await import("../../db/schema");
const { createTestPool, truncateAllTables } = await import("../../db/test-helper");
const { config } = await import("../../utils/config");
const originalRoutesDir = config.caddyRoutesDir;
config.caddyRoutesDir = routesDir;
const { extractRouteAssets, reconcileProjectRoute } = await import("../route-reconcile");

let pool: Pool;
let projectId: string;

const CERT = "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n";
const KEY = "-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n";

beforeAll(async () => {
	pool = createTestPool();
	const db = drizzle(pool, { schema });
	setDbProvider(async () => db);
});

beforeEach(async () => {
	await truncateAllTables(pool);
	const project = await createProject({ name: "route-project", serverId: "local" });
	projectId = project.id;
});

afterAll(async () => {
	await truncateAllTables(pool);
	await pool.end();
	config.caddyRoutesDir = originalRoutesDir;
	rmSync(routesDir, { recursive: true, force: true });
});

describe("extractRouteAssets", () => {
	it("collects referenced certificate assets without duplicates", () => {
		const snippet = `example.com {\n tls /etc/caddy/routes/example.com.crt /etc/caddy/routes/example.com.key\n respond "hi"\n}\nother.example.com {\n tls /etc/caddy/routes/example.com.crt /etc/caddy/routes/example.com.key\n}`;
		expect(extractRouteAssets(snippet)).toEqual(["example.com.crt", "example.com.key"]);
	});

	it("returns no assets for snippets without certificates", () => {
		expect(extractRouteAssets("example.com {\n reverse_proxy app:80\n}\n")).toEqual([]);
	});

	it("ignores paths outside the routes directory", () => {
		expect(extractRouteAssets("x {\n tls /etc/other/example.com.crt\n}")).toEqual([]);
	});
});

describe("reconcileProjectRoute", () => {
	it("reports when there is no running deployment to route to", async () => {
		const result = await reconcileProjectRoute(projectId);
		expect(result).toEqual({ applied: false, reason: "no running deployment" });
		expect(existsSync(join(routesDir, "route-project.caddy"))).toBe(false);
	});

	it("writes the rendered route and records it for a local deployment", async () => {
		const deployment = await createDeployment({
			projectId,
			serverId: "local",
			sourceType: "image",
			sourceRef: "nginx:alpine",
		});
		await updateDeploymentStatus(deployment.id, "running", {
			containerName: "route-project-abc12345",
			liveUrl: "http://route-project.localhost",
		});

		const result = await reconcileProjectRoute(projectId);

		expect(result.applied).toBe(true);
		const routePath = join(routesDir, "route-project.caddy");
		expect(existsSync(routePath)).toBe(true);
		const content = readFileSync(routePath, "utf8");
		expect(content).toContain("route-project.localhost");
		expect(content).toContain("reverse_proxy route-project-abc12345");
		const [route] = await listRoutesByDeployment(deployment.id);
		expect(route?.status).toBe("active");
		expect(route?.serverId).toBe("local");
	});

	it("ships custom certificate assets with the rendered route", async () => {
		const deployment = await createDeployment({
			projectId,
			serverId: "local",
			sourceType: "image",
			sourceRef: "nginx:alpine",
		});
		await updateDeploymentStatus(deployment.id, "running", { containerName: "route-project-abc12345" });
		const domain = await createDomain({
			projectId,
			domain: "secure.example.com",
			type: "custom",
			tlsMode: "custom",
			certificate: CERT,
			certificateKey: KEY,
			httpsRedirect: true,
			gzip: true,
		});
		const { updateDomainValidation } = await import("../../db/repo");
		await updateDomainValidation(domain.id, "verified", "provisioned");

		const result = await reconcileProjectRoute(projectId);

		expect(result.applied).toBe(true);
		const content = readFileSync(join(routesDir, "route-project.caddy"), "utf8");
		expect(content).toContain("/etc/caddy/routes/secure.example.com.crt");
		expect(existsSync(join(routesDir, "secure.example.com.crt"))).toBe(true);
		expect(existsSync(join(routesDir, "secure.example.com.key"))).toBe(true);
	});
});
