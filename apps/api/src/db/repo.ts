import { randomUUID } from 'node:crypto';
import { getDb } from './client';
import { config } from '../utils/config';
import { decryptValue, encryptValue } from '../utils/crypto';
import type {
  Alert, ApiKey, CreateAlertInput, CreateApiKeyInput, CreateDatabaseInput,
  CreateDeploymentInput, CreateDomainInput, CreateEnvironmentVariableInput,
  CreateProjectInput, CreateScalingPolicyInput, CreateServerInput, CreateVolumeInput,
  Database, DatabaseStatus, Deployment, DeploymentLog, DeploymentStatus,
  Domain, DomainValidationStatus, EnvironmentVariable, LogEvent, Project,
  ScalingPolicy, Server, ServerStatus, SslStatus, Volume,
} from '../types';

const now = () => new Date().toISOString();

// ─── Mappers ────────────────────────────────────────────

const mapDeployment = (row: any): Deployment => ({
  id: row.id,
  projectId: row.project_id,
  sourceType: row.source_type,
  sourceRef: row.source_ref,
  status: row.status,
  imageTag: row.image_tag,
  containerName: row.container_name,
  routePath: row.route_path,
  liveUrl: row.live_url,
  branch: row.branch,
  commitSha: row.commit_sha,
  replicas: row.replicas ?? 1,
  environment: row.environment,
  failureReason: row.failure_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapProject = (row: any): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  repoUrl: row.repo_url,
  repoBranch: row.repo_branch,
  baseDomain: row.base_domain,
  cpuLimit: row.cpu_limit,
  memoryLimitMb: row.memory_limit_mb,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapEnvVar = (row: any): EnvironmentVariable => ({
  id: row.id,
  projectId: row.project_id,
  key: row.key,
  value: row.value ?? '',
  environment: row.environment,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapVolume = (row: any): Volume => ({
  id: row.id,
  projectId: row.project_id,
  mountPath: row.mount_path,
  sizeMb: row.size_mb,
  dockerVolumeName: row.docker_volume_name,
  createdAt: row.created_at,
});

const mapDatabase = (row: any): Database => ({
  id: row.id,
  projectId: row.project_id,
  type: row.type,
  version: row.version,
  databaseName: row.database_name,
  username: row.username,
  password: row.password,
  internalHost: row.internal_host,
  internalPort: row.internal_port,
  cpuLimit: row.cpu_limit,
  memoryLimitMb: row.memory_limit_mb,
  connectionString: row.connection_string,
  status: row.status,
  containerName: row.container_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapDomain = (row: any): Domain => ({
  id: row.id,
  projectId: row.project_id,
  domain: row.domain,
  type: row.type,
  validationStatus: row.validation_status,
  sslStatus: row.ssl_status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapScalingPolicy = (row: any): ScalingPolicy => ({
  id: row.id,
  projectId: row.project_id,
  minReplicas: row.min_replicas,
  maxReplicas: row.max_replicas,
  cpuThresholdPercent: row.cpu_threshold_percent,
  memoryThresholdPercent: row.memory_threshold_percent,
  cooldownSeconds: row.cooldown_seconds,
  enabled: row.enabled === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapServer = (row: any): Server => ({
  id: row.id,
  name: row.name,
  host: row.host,
  port: row.port,
  authToken: row.auth_token,
  status: row.status,
  cpuTotal: row.cpu_total,
  memoryTotalMb: row.memory_total_mb,
  diskTotalMb: row.disk_total_mb,
  cpuUsedPercent: row.cpu_used_percent,
  memoryUsedMb: row.memory_used_mb,
  lastHeartbeat: row.last_heartbeat,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapApiKey = (row: any): ApiKey => ({
  id: row.id,
  name: row.name,
  keyHash: row.key_hash,
  permissions: row.permissions,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
});

const mapAlert = (row: any): Alert => ({
  id: row.id,
  projectId: row.project_id,
  type: row.type,
  threshold: row.threshold,
  durationSeconds: row.duration_seconds,
  channel: row.channel,
  destination: row.destination,
  enabled: row.enabled === 1,
  createdAt: row.created_at,
});

// ─── Deployments ────────────────────────────────────────

export const createDeployment = async (input: CreateDeploymentInput): Promise<Deployment> => {
  const db = await getDb();
  const id = randomUUID();
  const timestamp = now();
  db.query(
    `INSERT INTO deployments
      (id, project_id, source_type, source_ref, status, route_path, branch, commit_sha, environment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, input.projectId ?? null, input.sourceType, input.sourceRef,
    'pending', `/apps/${id}`, input.branch ?? null, input.commitSha ?? null,
    input.environment ?? null, timestamp, timestamp,
  );
  return mapDeployment(db.query('SELECT * FROM deployments WHERE id = ?').get(id));
};

export const listDeployments = async (projectId?: string): Promise<Deployment[]> => {
  const db = await getDb();
  const rows = projectId
    ? db.query('SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC').all(projectId)
    : db.query('SELECT * FROM deployments ORDER BY created_at DESC').all();
  return rows.map(mapDeployment);
};

export const getDeploymentById = async (id: string): Promise<Deployment | null> => {
  const db = await getDb();
  const row = db.query('SELECT * FROM deployments WHERE id = ?').get(id);
  return row ? mapDeployment(row) : null;
};

export const updateDeploymentCommitSha = async (id: string, commitSha: string) => {
  const db = await getDb();
  db.query('UPDATE deployments SET commit_sha = ?, updated_at = ? WHERE id = ?').run(commitSha, now(), id);
};

export const updateDeploymentStatus = async (
  id: string,
  status: DeploymentStatus,
  patch: Partial<Pick<Deployment, 'imageTag' | 'containerName' | 'liveUrl' | 'failureReason' | 'replicas'>> = {},
) => {
  const db = await getDb();
  db.query(
    `UPDATE deployments
     SET status = ?,
         image_tag = COALESCE(?, image_tag),
         container_name = COALESCE(?, container_name),
         live_url = COALESCE(?, live_url),
         failure_reason = COALESCE(?, failure_reason),
         replicas = COALESCE(?, replicas),
         updated_at = ?
     WHERE id = ?`,
  ).run(
    status,
    patch.imageTag ?? null,
    patch.containerName ?? null,
    patch.liveUrl ?? null,
    patch.failureReason ?? null,
    patch.replicas ?? null,
    now(),
    id,
  );
};

export const appendLog = async (
  deploymentId: string,
  stage: LogEvent['stage'],
  message: string,
): Promise<DeploymentLog> => {
  const db = await getDb();
  const createdAt = now();
  const row = db.query(
    'SELECT COALESCE(MAX(sequence), 0) as max_sequence FROM deployment_logs WHERE deployment_id = ?',
  ).get(deploymentId);
  const sequence = Number(row.max_sequence) + 1;
  const result = db.query(
    'INSERT INTO deployment_logs (deployment_id, sequence, stage, message, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(deploymentId, sequence, stage, message, createdAt);
  return {
    id: Number(result.lastInsertRowid),
    deploymentId, sequence, stage, message, createdAt,
  };
};

export const getLogs = async (deploymentId: string): Promise<DeploymentLog[]> => {
  const db = await getDb();
  const rows = db.query(
    'SELECT id, deployment_id, sequence, stage, message, created_at FROM deployment_logs WHERE deployment_id = ? ORDER BY sequence ASC',
  ).all(deploymentId);
  return rows.map((row: any) => ({
    id: row.id,
    deploymentId: row.deployment_id,
    sequence: row.sequence,
    stage: row.stage,
    message: row.message,
    createdAt: row.created_at,
  }));
};

// ─── Projects ──────────────────────────────────────────

export const createProject = async (input: CreateProjectInput): Promise<Project> => {
  const db = await getDb();
  const id = randomUUID();
  const timestamp = now();
  db.query(
    'INSERT INTO projects (id, name, description, repo_url, repo_branch, base_domain, cpu_limit, memory_limit_mb, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    input.name,
    input.description ?? null,
    input.repoUrl ?? null,
    input.repoBranch ?? null,
    input.baseDomain ?? null,
    input.cpuLimit ?? null,
    input.memoryLimitMb ?? null,
    timestamp,
    timestamp,
  );
  return mapProject(db.query('SELECT * FROM projects WHERE id = ?').get(id));
};

export const listProjects = async (): Promise<Project[]> => {
  const db = await getDb();
  return db.query('SELECT * FROM projects ORDER BY name ASC').all().map(mapProject);
};

export const getProjectById = async (id: string): Promise<Project | null> => {
  const db = await getDb();
  const row = db.query('SELECT * FROM projects WHERE id = ?').get(id);
  return row ? mapProject(row) : null;
};

export const updateProject = async (id: string, patch: Partial<CreateProjectInput>): Promise<Project | null> => {
  const db = await getDb();
  const existing = await getProjectById(id);
  if (!existing) return null;
  const name = patch.name ?? existing.name;
  const description = patch.description !== undefined ? patch.description : existing.description;
  const repoUrl = patch.repoUrl !== undefined ? patch.repoUrl : existing.repoUrl;
  const repoBranch = patch.repoBranch !== undefined ? patch.repoBranch : existing.repoBranch;
  const baseDomain = patch.baseDomain !== undefined ? patch.baseDomain : existing.baseDomain;
  const cpuLimit = patch.cpuLimit !== undefined ? patch.cpuLimit : existing.cpuLimit;
  const memoryLimitMb = patch.memoryLimitMb !== undefined ? patch.memoryLimitMb : existing.memoryLimitMb;
  db.query(
    'UPDATE projects SET name = ?, description = ?, repo_url = ?, repo_branch = ?, base_domain = ?, cpu_limit = ?, memory_limit_mb = ?, updated_at = ? WHERE id = ?',
  ).run(name, description, repoUrl, repoBranch, baseDomain, cpuLimit ?? null, memoryLimitMb ?? null, now(), id);
  return getProjectById(id);
};

export const deleteProject = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const result = db.query('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
};

// ─── Environment Variables ──────────────────────────────

export const createEnvironmentVariable = async (input: CreateEnvironmentVariableInput): Promise<EnvironmentVariable> => {
  const db = await getDb();
  const id = randomUUID();
  const timestamp = now();
  const env = input.environment ?? 'production';
  const encrypted = encryptValue(input.value, config.envEncryptionKey);
  db.query(
    'INSERT INTO environment_variables (id, project_id, key, value, value_encrypted, value_iv, value_tag, environment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, input.projectId, input.key, null, encrypted.encrypted, encrypted.iv, encrypted.tag, env, timestamp, timestamp);
  return mapEnvVar(db.query('SELECT * FROM environment_variables WHERE id = ?').get(id));
};

export const listEnvironmentVariables = async (projectId: string, environment?: string): Promise<EnvironmentVariable[]> => {
  const db = await getDb();
  const rows = environment
    ? db.query('SELECT * FROM environment_variables WHERE project_id = ? AND environment = ? ORDER BY key ASC').all(projectId, environment)
    : db.query('SELECT * FROM environment_variables WHERE project_id = ? ORDER BY key ASC').all(projectId);
  return rows.map(mapEnvVar);
};

export const getEnvironmentVariablePlaintext = async (id: string): Promise<string | null> => {
  const db = await getDb();
  const row = db.query('SELECT value, value_encrypted, value_iv, value_tag FROM environment_variables WHERE id = ?').get(id) as any;
  if (!row) return null;
  if (row.value_encrypted && row.value_iv && row.value_tag) {
    return decryptValue(row.value_encrypted, row.value_iv, row.value_tag, config.envEncryptionKey);
  }
  return row.value ?? null;
};

export const getEnvironmentVariableById = async (id: string): Promise<EnvironmentVariable | null> => {
  const db = await getDb();
  const row = db.query('SELECT * FROM environment_variables WHERE id = ?').get(id);
  return row ? mapEnvVar(row) : null;
};

export const updateEnvironmentVariable = async (id: string, value: string): Promise<EnvironmentVariable | null> => {
  const db = await getDb();
  const existing = await getEnvironmentVariableById(id);
  if (!existing) return null;
  const encrypted = encryptValue(value, config.envEncryptionKey);
  db.query('UPDATE environment_variables SET value = ?, value_encrypted = ?, value_iv = ?, value_tag = ?, updated_at = ? WHERE id = ?',
  ).run(null, encrypted.encrypted, encrypted.iv, encrypted.tag, now(), id);
  return getEnvironmentVariableById(id);
};

export const listEnvironmentVariablesForDeploy = async (projectId: string, environment?: string): Promise<{ key: string; value: string }[]> => {
  const db = await getDb();
  const rows = environment
    ? db.query('SELECT key, value, value_encrypted, value_iv, value_tag FROM environment_variables WHERE project_id = ? AND environment = ? ORDER BY key ASC').all(projectId, environment)
    : db.query('SELECT key, value, value_encrypted, value_iv, value_tag FROM environment_variables WHERE project_id = ? ORDER BY key ASC').all(projectId);
  return rows.map((row: any) => {
    if (row.value_encrypted && row.value_iv && row.value_tag) {
      return { key: row.key, value: decryptValue(row.value_encrypted, row.value_iv, row.value_tag, config.envEncryptionKey) };
    }
    return { key: row.key, value: row.value ?? '' };
  });
};

export const deleteEnvironmentVariable = async (id: string): Promise<boolean> => {
  const db = await getDb();
  return db.query('DELETE FROM environment_variables WHERE id = ?').run(id).changes > 0;
};

// ─── Volumes ────────────────────────────────────────────

export const createVolume = async (input: CreateVolumeInput): Promise<Volume> => {
  const db = await getDb();
  const id = randomUUID();
  const timestamp = now();
  const mountPath = input.mountPath ?? '/app/data';
  const volumeName = `vol-${id.slice(0, 8)}`;
  db.query(
    'INSERT INTO volumes (id, project_id, mount_path, docker_volume_name, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, input.projectId, mountPath, volumeName, timestamp);
  return mapVolume(db.query('SELECT * FROM volumes WHERE id = ?').get(id));
};

export const listVolumes = async (projectId: string): Promise<Volume[]> => {
  const db = await getDb();
  return db.query('SELECT * FROM volumes WHERE project_id = ? ORDER BY created_at DESC').all(projectId).map(mapVolume);
};

export const getVolumeById = async (id: string): Promise<Volume | null> => {
  const db = await getDb();
  const row = db.query('SELECT * FROM volumes WHERE id = ?').get(id);
  return row ? mapVolume(row) : null;
};

export const deleteVolume = async (id: string): Promise<boolean> => {
  const db = await getDb();
  return db.query('DELETE FROM volumes WHERE id = ?').run(id).changes > 0;
};

// ─── Databases ─────────────────────────────────────────

export const createDatabase = async (input: CreateDatabaseInput): Promise<Database> => {
  const db = await getDb();
  const id = randomUUID();
  const timestamp = now();
  const dbName = `db_${id.slice(0, 8)}`;
  const username = `user_${id.slice(0, 8)}`;
  const password = randomUUID().replace(/-/g, '').slice(0, 24);
  const internalHost = `db-${id.slice(0, 8)}`;
  const internalPort = input.type === 'mysql' ? 3306 : 5432;
  const version = input.version ?? null;
  const cpuLimit = input.cpuLimit ?? null;
  const memoryLimitMb = input.memoryLimitMb ?? null;
  const connStr = input.type === 'mysql'
    ? `mysql://${username}:${password}@${internalHost}:${internalPort}/${dbName}`
    : `postgresql://${username}:${password}@${internalHost}:${internalPort}/${dbName}`;
  db.query(
    `INSERT INTO databases (id, project_id, type, version, database_name, username, password, internal_host, internal_port, cpu_limit, memory_limit_mb, connection_string, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.projectId,
    input.type,
    version,
    dbName,
    username,
    password,
    internalHost,
    internalPort,
    cpuLimit,
    memoryLimitMb,
    connStr,
    'provisioning',
    timestamp,
    timestamp,
  );
  return mapDatabase(db.query('SELECT * FROM databases WHERE id = ?').get(id));
};

export const listAllDatabases = async (): Promise<Database[]> => {
  const db = await getDb();
  return db.query('SELECT * FROM databases ORDER BY created_at DESC').all().map(mapDatabase);
};

export const listDatabases = async (projectId: string): Promise<Database[]> => {
  const db = await getDb();
  return db.query('SELECT * FROM databases WHERE project_id = ? ORDER BY created_at DESC').all(projectId).map(mapDatabase);
};

export const getDatabaseById = async (id: string): Promise<Database | null> => {
  const db = await getDb();
  const row = db.query('SELECT * FROM databases WHERE id = ?').get(id);
  return row ? mapDatabase(row) : null;
};

export const updateDatabaseStatus = async (id: string, status: DatabaseStatus, containerName?: string): Promise<void> => {
  const db = await getDb();
  db.query(
    'UPDATE databases SET status = ?, container_name = COALESCE(?, container_name), updated_at = ? WHERE id = ?',
  ).run(status, containerName ?? null, now(), id);
};

export const deleteDatabase = async (id: string): Promise<boolean> => {
  const db = await getDb();
  return db.query('DELETE FROM databases WHERE id = ?').run(id).changes > 0;
};

// ─── Domains ────────────────────────────────────────────

export const createDomain = async (input: CreateDomainInput): Promise<Domain> => {
  const db = await getDb();
  const id = randomUUID();
  const timestamp = now();
  db.query(
    'INSERT INTO domains (id, project_id, domain, type, validation_status, ssl_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, input.projectId, input.domain, input.type, 'pending', 'pending', timestamp, timestamp);
  return mapDomain(db.query('SELECT * FROM domains WHERE id = ?').get(id));
};

export const listDomains = async (projectId: string): Promise<Domain[]> => {
  const db = await getDb();
  return db.query('SELECT * FROM domains WHERE project_id = ? ORDER BY created_at DESC').all(projectId).map(mapDomain);
};

export const getDomainById = async (id: string): Promise<Domain | null> => {
  const db = await getDb();
  const row = db.query('SELECT * FROM domains WHERE id = ?').get(id);
  return row ? mapDomain(row) : null;
};

export const updateDomainValidation = async (id: string, validationStatus: DomainValidationStatus, sslStatus?: SslStatus): Promise<void> => {
  const db = await getDb();
  db.query(
    'UPDATE domains SET validation_status = ?, ssl_status = COALESCE(?, ssl_status), updated_at = ? WHERE id = ?',
  ).run(validationStatus, sslStatus ?? null, now(), id);
};

export const updateDomainSslStatus = async (id: string, sslStatus: SslStatus): Promise<void> => {
  const db = await getDb();
  db.query('UPDATE domains SET ssl_status = ?, updated_at = ? WHERE id = ?').run(sslStatus, now(), id);
};

export const deleteDomain = async (id: string): Promise<boolean> => {
  const db = await getDb();
  return db.query('DELETE FROM domains WHERE id = ?').run(id).changes > 0;
};

// ─── Scaling Policies ───────────────────────────────────

export const upsertScalingPolicy = async (input: CreateScalingPolicyInput): Promise<ScalingPolicy> => {
  const db = await getDb();
  const existing = db.query('SELECT * FROM scaling_policies WHERE project_id = ?').get(input.projectId) as any;
  const timestamp = now();
  if (existing) {
    const minReplicas = input.minReplicas ?? existing.min_replicas;
    const maxReplicas = input.maxReplicas ?? existing.max_replicas;
    const cpuThreshold = input.cpuThresholdPercent ?? existing.cpu_threshold_percent;
    const memThreshold = input.memoryThresholdPercent ?? existing.memory_threshold_percent;
    db.query(
      `UPDATE scaling_policies SET min_replicas = ?, max_replicas = ?, cpu_threshold_percent = ?, memory_threshold_percent = ?, updated_at = ? WHERE project_id = ?`,
    ).run(minReplicas, maxReplicas, cpuThreshold, memThreshold, timestamp, input.projectId);
    return mapScalingPolicy(db.query('SELECT * FROM scaling_policies WHERE project_id = ?').get(input.projectId));
  }
  const id = randomUUID();
  db.query(
    `INSERT INTO scaling_policies (id, project_id, min_replicas, max_replicas, cpu_threshold_percent, memory_threshold_percent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, input.projectId,
    input.minReplicas ?? 1, input.maxReplicas ?? 5,
    input.cpuThresholdPercent ?? 70, input.memoryThresholdPercent ?? 85,
    timestamp, timestamp,
  );
  return mapScalingPolicy(db.query('SELECT * FROM scaling_policies WHERE id = ?').get(id));
};

export const getScalingPolicy = async (projectId: string): Promise<ScalingPolicy | null> => {
  const db = await getDb();
  const row = db.query('SELECT * FROM scaling_policies WHERE project_id = ?').get(projectId);
  return row ? mapScalingPolicy(row) : null;
};

export const deleteScalingPolicy = async (projectId: string): Promise<boolean> => {
  const db = await getDb();
  return db.query('DELETE FROM scaling_policies WHERE project_id = ?').run(projectId).changes > 0;
};

// ─── Servers ────────────────────────────────────────────

export const createServer = async (input: CreateServerInput): Promise<Server> => {
  const db = await getDb();
  const id = randomUUID();
  const timestamp = now();
  db.query(
    'INSERT INTO servers (id, name, host, port, auth_token, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, input.name, input.host, input.port ?? 2375, input.authToken, 'pending', timestamp, timestamp);
  return mapServer(db.query('SELECT * FROM servers WHERE id = ?').get(id));
};

export const listServers = async (): Promise<Server[]> => {
  const db = await getDb();
  return db.query('SELECT * FROM servers ORDER BY name ASC').all().map(mapServer);
};

export const getServerById = async (id: string): Promise<Server | null> => {
  const db = await getDb();
  const row = db.query('SELECT * FROM servers WHERE id = ?').get(id);
  return row ? mapServer(row) : null;
};

export const updateServerStatus = async (id: string, status: ServerStatus, resources?: {
  cpuTotal?: number; memoryTotalMb?: number; diskTotalMb?: number;
  cpuUsedPercent?: number; memoryUsedMb?: number;
}): Promise<void> => {
  const db = await getDb();
  db.query(
    `UPDATE servers SET status = ?, cpu_total = COALESCE(?, cpu_total), memory_total_mb = COALESCE(?, memory_total_mb),
     disk_total_mb = COALESCE(?, disk_total_mb), cpu_used_percent = COALESCE(?, cpu_used_percent),
     memory_used_mb = COALESCE(?, memory_used_mb), last_heartbeat = COALESCE(?, last_heartbeat), updated_at = ?
     WHERE id = ?`,
  ).run(
    status,
    resources?.cpuTotal ?? null, resources?.memoryTotalMb ?? null, resources?.diskTotalMb ?? null,
    resources?.cpuUsedPercent ?? null, resources?.memoryUsedMb ?? null,
    resources ? now() : null, now(), id,
  );
};

export const deleteServer = async (id: string): Promise<boolean> => {
  const db = await getDb();
  return db.query('DELETE FROM servers WHERE id = ?').run(id).changes > 0;
};

// ─── API Keys ───────────────────────────────────────────

export const createApiKey = async (input: CreateApiKeyInput): Promise<{ key: ApiKey; rawKey: string }> => {
  const db = await getDb();
  const id = randomUUID();
  const timestamp = now();
  const rawKey = `dql_${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '')}`;

  // Simple SHA-256 hash (Bun has built-in crypto)
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  db.query(
    'INSERT INTO api_keys (id, name, key_hash, permissions, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, input.name, keyHash, input.permissions ?? 'deploy:read', timestamp);
  return {
    key: mapApiKey(db.query('SELECT * FROM api_keys WHERE id = ?').get(id)),
    rawKey,
  };
};

export const listApiKeys = async (): Promise<ApiKey[]> => {
  const db = await getDb();
  return db.query('SELECT * FROM api_keys ORDER BY created_at DESC').all().map(mapApiKey);
};

export const deleteApiKey = async (id: string): Promise<boolean> => {
  const db = await getDb();
  return db.query('DELETE FROM api_keys WHERE id = ?').run(id).changes > 0;
};

export const validateApiKey = async (rawKey: string): Promise<ApiKey | null> => {
  const db = await getDb();
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const row = db.query('SELECT * FROM api_keys WHERE key_hash = ?').get(keyHash);
  if (!row) return null;
  db.query('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now(), row.id);
  return mapApiKey(row);
};

// ─── Alerts ─────────────────────────────────────────────

export const createAlert = async (input: CreateAlertInput): Promise<Alert> => {
  const db = await getDb();
  const id = randomUUID();
  const timestamp = now();
  db.query(
    'INSERT INTO alerts (id, project_id, type, threshold, duration_seconds, channel, destination, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, input.projectId, input.type, input.threshold ?? null, input.durationSeconds ?? null, input.channel, input.destination ?? null, timestamp);
  return mapAlert(db.query('SELECT * FROM alerts WHERE id = ?').get(id));
};

export const listAlerts = async (projectId?: string): Promise<Alert[]> => {
  const db = await getDb();
  const rows = projectId
    ? db.query('SELECT * FROM alerts WHERE project_id = ? ORDER BY created_at DESC').all(projectId)
    : db.query('SELECT * FROM alerts ORDER BY created_at DESC').all();
  return rows.map(mapAlert);
};

export const getAlertById = async (id: string): Promise<Alert | null> => {
  const db = await getDb();
  const row = db.query('SELECT * FROM alerts WHERE id = ?').get(id);
  return row ? mapAlert(row) : null;
};

export const updateAlertEnabled = async (id: string, enabled: boolean): Promise<Alert | null> => {
  const db = await getDb();
  db.query('UPDATE alerts SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  return getAlertById(id);
};

export const deleteAlert = async (id: string): Promise<boolean> => {
  const db = await getDb();
  return db.query('DELETE FROM alerts WHERE id = ?').run(id).changes > 0;
};
