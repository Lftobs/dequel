import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { setDbProvider } from "../db-provider";
import * as schema from "../schema";
import {
	linkSharedEnvVarsToProject,
	listLinkedSharedEnvVars,
	unlinkSharedEnvVarFromProject,
} from "../repo/shared-env-vars";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://dequel:dequel@localhost:5433/dequel";
const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const db = drizzle(pool, { schema });
setDbProvider(async () => db);

const cleanup = async () => {
	await pool.query('DELETE FROM "project_shared_env_links" WHERE project_id LIKE $1', ["test-sel-%"]);
	await pool.query('DELETE FROM "shared_env_vars" WHERE key LIKE $1', ["TEST_SEL_%"]);
	await pool.query('DELETE FROM "projects" WHERE id LIKE $1', ["test-sel-%"]);
};

try {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS "shared_env_vars" (
			"id" text PRIMARY KEY,
			"key" text NOT NULL,
			"value" text NOT NULL DEFAULT '',
			"value_encrypted" text,
			"value_iv" text,
			"value_tag" text,
			"environment" text DEFAULT 'production',
			"description" text,
			"tags" jsonb DEFAULT '[]',
			"created_at" timestamp DEFAULT now(),
			"updated_at" timestamp DEFAULT now()
		)
	`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS "project_shared_env_links" (
			"id" text PRIMARY KEY,
			"project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
			"shared_env_var_id" text NOT NULL REFERENCES "shared_env_vars"("id") ON DELETE CASCADE,
			"created_at" timestamp DEFAULT now()
		)
	`);
	await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "project_shared_env_links_project_shared_idx" ON "project_shared_env_links" ("project_id", "shared_env_var_id")`);
	await cleanup();

	const projectId = `test-sel-${randomUUID().slice(0, 8)}`;
	const varId1 = randomUUID();
	const varId2 = randomUUID();

	await pool.query(
		`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ($1, 'test', 'git', NOW(), NOW())`,
		[projectId],
	);
	await pool.query(
		`INSERT INTO shared_env_vars (id, key, value, environment, created_at, updated_at) VALUES ($1, 'TEST_SEL_DB_URL', '', 'production', NOW(), NOW())`,
		[varId1],
	);
	await pool.query(
		`INSERT INTO shared_env_vars (id, key, value, environment, created_at, updated_at) VALUES ($1, 'TEST_SEL_API_KEY', '', 'production', NOW(), NOW())`,
		[varId2],
	);

	await linkSharedEnvVarsToProject(projectId, [varId1, varId2]);
	let linked = await listLinkedSharedEnvVars(projectId);
	const linkCount1 = linked.length;
	const hasVar1 = linked.some((v) => v.key === "TEST_SEL_DB_URL");
	const hasVar2 = linked.some((v) => v.key === "TEST_SEL_API_KEY");
	const hasLinkId = linked.every((v) => typeof v.linkId === "string" && v.linkId.length > 0);

	await linkSharedEnvVarsToProject(projectId, [varId1]);
	linked = await listLinkedSharedEnvVars(projectId);
	const afterRelink = linked.length;

	const target = linked.find((v) => v.key === "TEST_SEL_API_KEY");
	const unlinkResult = await unlinkSharedEnvVarFromProject(projectId, target!.id);
	linked = await listLinkedSharedEnvVars(projectId);
	const afterUnlink = linked.length;
	const stillHasVar1 = linked.some((v) => v.key === "TEST_SEL_DB_URL");

	const badUnlink = await unlinkSharedEnvVarFromProject(projectId, "nonexistent");

	await unlinkSharedEnvVarFromProject(projectId, varId1);
	const empty = await listLinkedSharedEnvVars(projectId);

	console.log(
		JSON.stringify({
			linkCount: linkCount1,
			hasVar1,
			hasVar2,
			hasLinkId,
			afterRelink,
			unlinkResult,
			afterUnlink,
			stillHasVar1,
			badUnlink,
			emptyCount: empty.length,
		}),
	);
} finally {
	await cleanup();
	await pool.end();
}
