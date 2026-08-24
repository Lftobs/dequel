import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { setDbProvider } from "../../db/db-provider";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://dequel:dequel@localhost:5433/dequel";
const TABLE_NAMES = [
  "agent_credentials", "agent_jobs", "agent_registration_tokens", "alerts", "api_keys",
  "deployment_events", "deployment_logs", "deployments", "databases", "domains", "environment_variables",
  "github_integrations", "platform_settings", "projects", "refresh_tokens", "routes",
  "scaling_policies", "servers", "smtp_settings", "volumes",
];

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const db = drizzle(pool, { schema });
setDbProvider(async () => db);

const cleanup = async () => {
  await pool.query(`DELETE FROM domains WHERE id IN ('d-ds-1', 'd-ds-2')`);
  await pool.query(`DELETE FROM projects WHERE id IN ('proj-ds-1', 'proj-ds-missing')`);
};

try {
  const { domainsRoutes } = await import("../domains/index");

  await cleanup();
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-ds-1', 'Test', 'git', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-ds-missing', 'NoDomains', 'git', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`);

  await pool.query(`INSERT INTO domains (id, project_id, domain, type, validation_status, ssl_status, created_at) VALUES ('d-ds-1', 'proj-ds-1', 'example.com', 'custom', 'pending', 'pending', NOW()) ON CONFLICT (id) DO NOTHING`);
  await pool.query(`INSERT INTO domains (id, project_id, domain, type, validation_status, ssl_status, created_at) VALUES ('d-ds-2', 'proj-ds-1', 'nonexistent.invalid', 'custom', 'pending', 'pending', NOW()) ON CONFLICT (id) DO NOTHING`);

  const app = domainsRoutes;

  const handle = async (path: string) => {
    const req = new Request(`http://localhost${path}`);
    return app.handle(req);
  };

  const results: any = {};

  // Test 1: returns array for project with domains
  const r1 = await handle("/projects/proj-ds-1/domains/status");
  const b1 = await r1.json();
  const d1 = b1.data ?? b1;
  results.test1 = { status: r1.status, isArray: Array.isArray(d1), length: d1.length };

  // Test 2: returns 404 for missing project
  const r2 = await handle("/projects/missing-domains/domains/status");
  results.test2 = { status: r2.status };

  // Test 3: empty array for project with no domains
  const r3 = await handle("/projects/proj-ds-missing/domains/status");
  const b3 = await r3.json();
  const d3 = b3.data ?? b3;
  results.test3 = { status: r3.status, length: d3.length };

  console.log(JSON.stringify(results));
} catch (err: any) {
  console.error("Runner error:", err?.message ?? String(err));
  console.error(err?.stack ?? err);
  process.exit(1);
} finally {
  await cleanup();
  await pool.end();
}
