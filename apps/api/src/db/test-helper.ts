import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema';
import { setDbProvider } from './db-provider';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://dequel:dequel@localhost:5433/dequel';

const TABLE_NAMES = [
  'agent_credentials',
  'agent_jobs',
  'agent_registration_tokens',
  'alerts',
  'api_keys',
  'deployment_events',
  'deployment_logs',
  'deployments',
  'databases',
  'domains',
  'environment_variables',
  'github_integrations',
  'platform_settings',
  'projects',
  'refresh_tokens',
  'routes',
  'scaling_policies',
  'servers',
  'smtp_settings',
  'ai_settings',
  'ai_diagnoses',
  'volumes',
];

import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';

export const createTestPool = () => new Pool({ connectionString: TEST_DATABASE_URL });

export const setupTestDb = async () => {
  const pool = createTestPool();
  const db = drizzle(pool, { schema });
  setDbProvider(async () => db);
  const migrationsFolder = join(import.meta.dirname, 'migrations');
  try {
    await drizzleMigrate(db, { migrationsFolder });
  } catch (err: any) {
    if (!err?.message?.includes('already exists') && err?.code !== '42P07') {
      console.warn('[setupTestDb] Migration warning:', err);
    }
  }
  return { db, pool };
};

export const truncateAllTables = async (pool: Pool) => {
  for (const name of TABLE_NAMES) {
    try {
      await pool.query(`TRUNCATE TABLE "${name}" CASCADE`);
    } catch {}
  }
};

export const teardownTestDb = async (pool: Pool) => {
  await pool.end();
};
