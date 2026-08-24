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
  for (const name of TABLE_NAMES) {
    await pool.query(`TRUNCATE TABLE "${name}" CASCADE`);
  }
};

try {
  const { domainsRoutes } = await import("../domains/index");

  await cleanup();
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-1', 'Test', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-missing', 'NoDomains', 'git', NOW(), NOW())`);

  await pool.query(`INSERT INTO domains (id, project_id, domain, type, validation_status, ssl_status, created_at) VALUES ('d1', 'proj-1', 'example.com', 'custom', 'pending', 'pending', NOW())`);
  await pool.query(`INSERT INTO domains (id, project_id, domain, type, validation_status, ssl_status, created_at) VALUES ('d2', 'proj-1', 'nonexistent.invalid', 'custom', 'pending', 'pending', NOW())`);

  const app = domainsRoutes;

  const handle = async (path: string) => {
    const req = new Request(`http://localhost${path}`);
    return app.handle(req);
  };

  const results: any = {};

  // Test 1: returns array for project with domains
  const r1 = await handle("/projects/proj-1/domains/status");
  const b1 = await r1.json();
  results.test1 = { status: r1.status, isArray: Array.isArray(b1), length: b1.length };

  // Test 2: returns 404 for missing project
  const r2 = await handle("/projects/missing-domains/domains/status");
  results.test2 = { status: r2.status };

  // Test 3: empty array for project with no domains
  const r3 = await handle("/projects/proj-missing/domains/status");
  const b3 = await r3.json();
  results.test3 = { status: r3.status, length: b3.length };

  console.log(JSON.stringify(results));
} catch (err: any) {
  console.error("Runner error:", err?.message ?? String(err));
  console.error(err?.stack ?? err);
  process.exit(1);
} finally {
  await cleanup();
  await pool.end();
}
