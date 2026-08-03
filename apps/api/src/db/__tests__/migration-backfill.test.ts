import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationSql = readFileSync(join(import.meta.dir, '..', 'migrations', '0007_standalone_databases.sql'), 'utf8');

const createLegacySchema = (db: Database) => {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE IF NOT EXISTS "projects" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "source_type" text NOT NULL DEFAULT 'git',
      "created_at" text NOT NULL,
      "updated_at" text NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "databases" (
      "id" text PRIMARY KEY NOT NULL,
      "project_id" text NOT NULL,
      "type" text NOT NULL,
      "version" text,
      "database_name" text NOT NULL,
      "username" text NOT NULL,
      "password" text NOT NULL,
      "internal_host" text NOT NULL,
      "internal_port" integer NOT NULL,
      "cpu_limit" real,
      "memory_limit_mb" integer,
      "connection_string" text NOT NULL,
      "status" text NOT NULL DEFAULT 'provisioning',
      "container_name" text,
      "created_at" text NOT NULL,
      "updated_at" text NOT NULL,
      FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
    );
  `);
};

const applyMigration = (db: Database) => {
  for (const statement of migrationSql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed) db.exec(trimmed);
  }
};

describe('0007 standalone databases migration', () => {
  it('backfills legacy databases as private standalone records', () => {
    const db = new Database(':memory:');
    createLegacySchema(db);
    db.run(
      `INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-1', 'legacy', 'git', '2026-01-01', '2026-01-01')`,
    );
    db.run(
      `INSERT INTO databases (id, project_id, type, version, database_name, username, password, internal_host, internal_port, connection_string, status, created_at, updated_at)
       VALUES ('legacy-db-1', 'proj-1', 'postgresql', '16', 'legacydb', 'user_1', 'pw', 'legacy-db-1', 5432, 'postgresql://user_1:pw@legacy-db-1:5432/legacydb', 'running', '2026-01-01', '2026-01-01')`,
    );
    applyMigration(db);

    const row = db.query(`SELECT * FROM databases WHERE id = 'legacy-db-1'`).get() as any;
    expect(row.name).toBe('legacydb');
    expect(row.project_id).toBe('proj-1');
    expect(row.volume_name).toBe('db-legacy-db-1');
    expect(row.public_access).toBe(0);
    expect(row.allow_public_access_from_anywhere).toBe(0);
    expect(row.allowed_cidrs).toBe('[]');
    expect(row.external_port).toBeNull();
    expect(row.proxy_container_name).toBeNull();
    expect(row.storage_limit_mb).toBeNull();
    expect(row.storage_used_mb).toBe(0);
  });

  it('detaches databases when the attached project is deleted', () => {
    const db = new Database(':memory:');
    createLegacySchema(db);
    db.run(
      `INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-1', 'legacy', 'git', '2026-01-01', '2026-01-01')`,
    );
    db.run(
      `INSERT INTO databases (id, project_id, type, version, database_name, username, password, internal_host, internal_port, connection_string, status, created_at, updated_at)
       VALUES ('legacy-db-1', 'proj-1', 'postgresql', '16', 'legacydb', 'user_1', 'pw', 'legacy-db-1', 5432, 'postgresql://user_1:pw@legacy-db-1:5432/legacydb', 'running', '2026-01-01', '2026-01-01')`,
    );
    applyMigration(db);

    db.exec(`DELETE FROM projects WHERE id = 'proj-1'`);
    const row = db.query(`SELECT * FROM databases WHERE id = 'legacy-db-1'`).get() as any;
    expect(row.project_id).toBeNull();
    expect(row.name).toBe('legacydb');
  });
});
