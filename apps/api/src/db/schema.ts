import { pgTable, text, integer, real, boolean, serial, jsonb, timestamp, foreignKey, uniqueIndex, index } from "drizzle-orm/pg-core";

export const githubSessions = pgTable("github_sessions", {
  id: text().primaryKey(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  accessTokenIv: text("access_token_iv").notNull(),
  accessTokenTag: text("access_token_tag").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const githubIntegrations = pgTable("github_integrations", {
  id: text().primaryKey(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  appName: text("app_name").notNull().default("Dequel"),
  webhookSecret: text("webhook_secret"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: text().primaryKey(),
  serverId: text("server_id"),
  name: text().notNull(),
  description: text(),
  repoUrl: text("repo_url"),
  repoBranch: text("repo_branch"),
  baseDomain: text("base_domain"),
  cpuLimit: real("cpu_limit"),
  memoryLimitMb: integer("memory_limit_mb"),
  port: integer("port"),
  sourceDir: text("source_dir"),
  sourceType: text("source_type").default("git").notNull(),
  projectType: text("project_type").default("web").notNull(),
  buildType: text("build_type").default("railpack").notNull(),
  composeService: text("compose_service"),
  composePort: integer("compose_port"),
  composeServices: jsonb("compose_services"),
  buildCommand: text("build_command"),
  installCommand: text("install_command"),
  outputDir: text("output_dir"),
  startCommand: text("start_command"),
  githubTokenEncrypted: text("github_token_encrypted"),
  githubTokenIv: text("github_token_iv"),
  githubTokenTag: text("github_token_tag"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deployments = pgTable("deployments", {
  id: text().primaryKey(),
  projectId: text("project_id"),
  serverId: text("server_id"),
  sourceType: text("source_type").notNull(),
  sourceRef: text("source_ref").notNull(),
  status: text().notNull().default("pending"),
  imageTag: text("image_tag"),
  containerName: text("container_name"),
  routePath: text("route_path"),
  liveUrl: text("live_url"),
  branch: text(),
  commitSha: text("commit_sha"),
  replicas: integer().notNull().default(1),
  environment: text(),
  failureReason: text("failure_reason"),
  clearCache: boolean("clear_cache").notNull().default(false),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deploymentLogs = pgTable("deployment_logs", {
  id: serial().primaryKey(),
  deploymentId: text("deployment_id").notNull(),
  sequence: integer().notNull(),
  stage: text().notNull(),
  message: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.deploymentId], foreignColumns: [deployments.id], onDelete: "cascade" }),
  uniqueIndex("idx_logs_dep_seq").on(table.deploymentId, table.sequence),
]);

export const deploymentEvents = pgTable("deployment_events", {
  id: text().primaryKey(),
  deploymentId: text("deployment_id").notNull(),
  type: text().notNull(),
  message: text(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.deploymentId], foreignColumns: [deployments.id], onDelete: "cascade" }),
  index("idx_events_dep_type").on(table.deploymentId, table.type),
]);

export const environmentVariables = pgTable("environment_variables", {
  id: text().primaryKey(),
  projectId: text("project_id").notNull(),
  key: text().notNull(),
  value: text().notNull(),
  valueEncrypted: text("value_encrypted"),
  valueIv: text("value_iv"),
  valueTag: text("value_tag"),
  environment: text().notNull().default("production"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" }),
  index("idx_env_vars_project").on(table.projectId, table.environment),
]);

export const volumes = pgTable("volumes", {
  id: text().primaryKey(),
  projectId: text("project_id").notNull(),
  mountPath: text("mount_path").notNull().default("/app/data"),
  sizeMb: integer("size_mb"),
  dockerVolumeName: text("docker_volume_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" }),
]);

export const databases = pgTable("databases", {
  id: text().primaryKey(),
  projectId: text("project_id"),
  name: text().notNull(),
  type: text().notNull(),
  version: text(),
  databaseName: text("database_name").notNull(),
  username: text().notNull(),
  password: text().notNull(),
  internalHost: text("internal_host").notNull(),
  internalPort: integer("internal_port").notNull(),
  cpuLimit: real("cpu_limit"),
  memoryLimitMb: integer("memory_limit_mb"),
  storageLimitMb: integer("storage_limit_mb"),
  storageUsedMb: integer("storage_used_mb").notNull().default(0),
  publicAccess: boolean("public_access").notNull().default(true),
  allowPublicAccessFromAnywhere: boolean("allow_public_access_from_anywhere").notNull().default(false),
  allowedCidrs: jsonb("allowed_cidrs").notNull().default([]),
  externalPort: integer("external_port"),
  proxyContainerName: text("proxy_container_name"),
  volumeName: text("volume_name").notNull(),
  connectionString: text("connection_string").notNull(),
  status: text().notNull().default("provisioning"),
  containerName: text("container_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "set null" }),
]);

export const domains = pgTable("domains", {
  id: text().primaryKey(),
  projectId: text("project_id").notNull(),
  domain: text().notNull(),
  type: text().notNull().default("custom"),
  validationStatus: text("validation_status").notNull().default("pending"),
  sslStatus: text("ssl_status").notNull().default("pending"),
  targetService: text("target_service"),
  targetPort: integer("target_port"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" }),
]);

export const scalingPolicies = pgTable("scaling_policies", {
  id: text().primaryKey(),
  projectId: text("project_id").notNull().unique(),
  minReplicas: integer("min_replicas").notNull().default(1),
  maxReplicas: integer("max_replicas").notNull().default(5),
  cpuThresholdPercent: integer("cpu_threshold_percent").notNull().default(70),
  memoryThresholdPercent: integer("memory_threshold_percent").notNull().default(85),
  cooldownSeconds: integer("cooldown_seconds").notNull().default(120),
  enabled: boolean().notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" }),
]);

export const servers = pgTable("servers", {
  id: text().primaryKey(),
  name: text().notNull(),
  host: text().notNull(),
  port: integer().notNull().default(2375),
  authToken: text("auth_token").notNull().default(""),
  sshUser: text("ssh_user"),
  sshKey: text("ssh_key"),
  sshKeyIv: text("ssh_key_iv"),
  sshKeyTag: text("ssh_key_tag"),
  sshPassword: text("ssh_password"),
  mode: text().notNull().default("ssh"),
  agentId: text("agent_id").unique(),
  agentVersion: text("agent_version"),
  peerIp: text("peer_ip"),
  capabilities: jsonb().notNull().default({}),
  labels: jsonb().notNull().default({}),
  status: text().notNull().default("pending"),
  cpuTotal: integer("cpu_total"),
  memoryTotalMb: integer("memory_total_mb"),
  diskTotalMb: integer("disk_total_mb"),
  cpuUsedPercent: real("cpu_used_percent"),
  memoryUsedMb: integer("memory_used_mb"),
  lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
  registeredAt: timestamp("registered_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentRegistrationTokens = pgTable("agent_registration_tokens", {
  id: text().primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  serverName: text("server_name").notNull(),
  labels: jsonb().notNull().default({}),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentCredentials = pgTable("agent_credentials", {
  id: text().primaryKey(),
  serverId: text("server_id").notNull(),
  credentialHash: text("credential_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.serverId], foreignColumns: [servers.id], onDelete: "cascade" }),
]);

export const agentJobs = pgTable("agent_jobs", {
  id: text().primaryKey(),
  deploymentId: text("deployment_id"),
  serverId: text("server_id").notNull(),
  type: text().notNull(),
  payload: jsonb().notNull(),
  status: text().notNull().default("queued"),
  attempts: integer().notNull().default(0),
  leaseId: text("lease_id"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.serverId], foreignColumns: [servers.id], onDelete: "cascade" }),
  foreignKey({ columns: [table.deploymentId], foreignColumns: [deployments.id], onDelete: "cascade" }),
  index("idx_agent_jobs_server_status").on(table.serverId, table.status),
]);

export const refreshTokens = pgTable("refresh_tokens", {
	id: text().primaryKey(),
	username: text().notNull(),
	tokenHash: text("token_hash").notNull().unique(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	blacklistedAt: timestamp("blacklisted_at", { withTimezone: true }),
});

export const apiKeys = pgTable("api_keys", {
  id: text().primaryKey(),
  name: text().notNull(),
  keyHash: text("key_hash").notNull(),
  permissions: text().notNull().default("deploy:read"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const alerts = pgTable("alerts", {
  id: text().primaryKey(),
  projectId: text("project_id").notNull(),
  type: text().notNull(),
  threshold: real(),
  durationSeconds: integer("duration_seconds"),
  channel: text().notNull().default("email"),
  destination: text(),
  enabled: boolean().notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" }),
]);

export const smtpSettings = pgTable("smtp_settings", {
  id: text().primaryKey(),
  host: text().notNull(),
  port: integer().notNull().default(587),
  user: text().notNull().default(""),
  passEncrypted: text("pass_encrypted"),
  passIv: text("pass_iv"),
  passTag: text("pass_tag"),
  fromAddress: text("from_address").notNull().default("dequel@localhost"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformSettings = pgTable("platform_settings", {
  id: text().primaryKey(),
  ingressServerId: text("ingress_server_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const routes = pgTable("routes", {
  id: text().primaryKey(),
  serverId: text("server_id"),
  deploymentId: text("deployment_id"),
  projectId: text("project_id"),
  hostname: text().notNull(),
  routeFile: text("route_file").notNull(),
  port: integer().notNull(),
  targetContainers: jsonb("target_containers").notNull(),
  upstreamHost: text("upstream_host"),
  status: text().notNull().default("pending"),
  lastError: text("last_error"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_routes_hostname_server").on(table.hostname, table.serverId),
]);
