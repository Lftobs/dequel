import { getDb } from './client';

export const migrate = async () => {
  const db = await getDb();
  // Safe migration: add columns only if they don't exist
  const tableColumns = (table: string) => db.query(`PRAGMA table_info(${table})`).all() as any[];
  const projectCols = tableColumns('projects');
  const hasRepoUrl = projectCols.some((c: any) => c.name === 'repo_url');
  const hasRepoBranch = projectCols.some((c: any) => c.name === 'repo_branch');
  const hasCpuLimit = projectCols.some((c: any) => c.name === 'cpu_limit');
  const hasMemoryLimit = projectCols.some((c: any) => c.name === 'memory_limit_mb');
  if (!hasRepoUrl) db.exec('ALTER TABLE projects ADD COLUMN repo_url TEXT');
  if (!hasRepoBranch) db.exec('ALTER TABLE projects ADD COLUMN repo_branch TEXT');
  if (!hasCpuLimit) db.exec('ALTER TABLE projects ADD COLUMN cpu_limit REAL');
  if (!hasMemoryLimit) db.exec('ALTER TABLE projects ADD COLUMN memory_limit_mb INTEGER');

  const envCols = tableColumns('environment_variables');
  const hasEncValue = envCols.some((c: any) => c.name === 'value_encrypted');
  const hasEncIv = envCols.some((c: any) => c.name === 'value_iv');
  const hasEncTag = envCols.some((c: any) => c.name === 'value_tag');
  if (!hasEncValue) db.exec('ALTER TABLE environment_variables ADD COLUMN value_encrypted TEXT');
  if (!hasEncIv) db.exec('ALTER TABLE environment_variables ADD COLUMN value_iv TEXT');
  if (!hasEncTag) db.exec('ALTER TABLE environment_variables ADD COLUMN value_tag TEXT');

  const dbCols = tableColumns('databases');
  const hasDbVersion = dbCols.some((c: any) => c.name === 'version');
  const hasDbCpu = dbCols.some((c: any) => c.name === 'cpu_limit');
  const hasDbMemory = dbCols.some((c: any) => c.name === 'memory_limit_mb');
  if (!hasDbVersion) db.exec('ALTER TABLE databases ADD COLUMN version TEXT');
  if (!hasDbCpu) db.exec('ALTER TABLE databases ADD COLUMN cpu_limit REAL');
  if (!hasDbMemory) db.exec('ALTER TABLE databases ADD COLUMN memory_limit_mb INTEGER');

  db.exec(`
    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      source_type TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      image_tag TEXT,
      container_name TEXT,
      route_path TEXT,
      live_url TEXT,
      branch TEXT,
      commit_sha TEXT,
      replicas INTEGER NOT NULL DEFAULT 1,
      environment TEXT,
      failure_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deployment_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deployment_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      stage TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(deployment_id) REFERENCES deployments(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_dep_seq
      ON deployment_logs(deployment_id, sequence);

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      repo_url TEXT,
      repo_branch TEXT,
      base_domain TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS environment_variables (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      environment TEXT NOT NULL DEFAULT 'production',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_env_vars_project
      ON environment_variables(project_id, environment);

    CREATE TABLE IF NOT EXISTS volumes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      mount_path TEXT NOT NULL DEFAULT '/app/data',
      size_mb INTEGER,
      docker_volume_name TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS databases (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      database_name TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      internal_host TEXT NOT NULL,
      internal_port INTEGER NOT NULL,
      connection_string TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'provisioning',
      container_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS domains (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'custom',
      validation_status TEXT NOT NULL DEFAULT 'pending',
      ssl_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scaling_policies (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      min_replicas INTEGER NOT NULL DEFAULT 1,
      max_replicas INTEGER NOT NULL DEFAULT 5,
      cpu_threshold_percent INTEGER NOT NULL DEFAULT 70,
      memory_threshold_percent INTEGER NOT NULL DEFAULT 85,
      cooldown_seconds INTEGER NOT NULL DEFAULT 120,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 2375,
      auth_token TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      cpu_total INTEGER,
      memory_total_mb INTEGER,
      disk_total_mb INTEGER,
      cpu_used_percent REAL,
      memory_used_mb INTEGER,
      last_heartbeat TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT 'deploy:read',
      created_at TEXT NOT NULL,
      last_used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      threshold REAL,
      duration_seconds INTEGER,
      channel TEXT NOT NULL DEFAULT 'email',
      destination TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
};
