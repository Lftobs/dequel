import { sqliteTable, text, integer, real, foreignKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const githubIntegrations = sqliteTable("github_integrations", {
  id: text().primaryKey(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  appName: text("app_name").notNull().default("Dequel"),
  webhookSecret: text("webhook_secret"),
  createdAt: text("created_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text(),
  repoUrl: text("repo_url"),
  repoBranch: text("repo_branch"),
  baseDomain: text("base_domain"),
  cpuLimit: real("cpu_limit"),
  memoryLimitMb: integer("memory_limit_mb"),
  githubTokenEncrypted: text("github_token_encrypted"),
  githubTokenIv: text("github_token_iv"),
  githubTokenTag: text("github_token_tag"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const deployments = sqliteTable("deployments", {
  id: text().primaryKey(),
  projectId: text("project_id"),
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
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const deploymentLogs = sqliteTable("deployment_logs", {
  id: integer().primaryKey({ autoIncrement: true }),
  deploymentId: text("deployment_id").notNull(),
  sequence: integer().notNull(),
  stage: text().notNull(),
  message: text().notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  foreignKey({ columns: [table.deploymentId], foreignColumns: [deployments.id] }),
  uniqueIndex("idx_logs_dep_seq").on(table.deploymentId, table.sequence),
]);

export const environmentVariables = sqliteTable("environment_variables", {
  id: text().primaryKey(),
  projectId: text("project_id").notNull(),
  key: text().notNull(),
  value: text().notNull(),
  valueEncrypted: text("value_encrypted"),
  valueIv: text("value_iv"),
  valueTag: text("value_tag"),
  environment: text().notNull().default("production"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" }),
  index("idx_env_vars_project").on(table.projectId, table.environment),
]);

export const volumes = sqliteTable("volumes", {
  id: text().primaryKey(),
  projectId: text("project_id").notNull(),
  mountPath: text("mount_path").notNull().default("/app/data"),
  sizeMb: integer("size_mb"),
  dockerVolumeName: text("docker_volume_name"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" }),
]);

export const databases = sqliteTable("databases", {
  id: text().primaryKey(),
  projectId: text("project_id").notNull(),
  type: text().notNull(),
  version: text(),
  databaseName: text("database_name").notNull(),
  username: text().notNull(),
  password: text().notNull(),
  internalHost: text("internal_host").notNull(),
  internalPort: integer("internal_port").notNull(),
  cpuLimit: real("cpu_limit"),
  memoryLimitMb: integer("memory_limit_mb"),
  connectionString: text("connection_string").notNull(),
  status: text().notNull().default("provisioning"),
  containerName: text("container_name"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" }),
]);

export const domains = sqliteTable("domains", {
  id: text().primaryKey(),
  projectId: text("project_id").notNull(),
  domain: text().notNull(),
  type: text().notNull().default("custom"),
  validationStatus: text("validation_status").notNull().default("pending"),
  sslStatus: text("ssl_status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" }),
]);

export const scalingPolicies = sqliteTable("scaling_policies", {
  id: text().primaryKey(),
  projectId: text("project_id").notNull().unique(),
  minReplicas: integer("min_replicas").notNull().default(1),
  maxReplicas: integer("max_replicas").notNull().default(5),
  cpuThresholdPercent: integer("cpu_threshold_percent").notNull().default(70),
  memoryThresholdPercent: integer("memory_threshold_percent").notNull().default(85),
  cooldownSeconds: integer("cooldown_seconds").notNull().default(120),
  enabled: integer().notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" }),
]);

export const servers = sqliteTable("servers", {
  id: text().primaryKey(),
  name: text().notNull(),
  host: text().notNull(),
  port: integer().notNull().default(2375),
  authToken: text("auth_token").notNull().default(""),
  status: text().notNull().default("pending"),
  cpuTotal: integer("cpu_total"),
  memoryTotalMb: integer("memory_total_mb"),
  diskTotalMb: integer("disk_total_mb"),
  cpuUsedPercent: real("cpu_used_percent"),
  memoryUsedMb: integer("memory_used_mb"),
  lastHeartbeat: text("last_heartbeat"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text().primaryKey(),
  name: text().notNull(),
  keyHash: text("key_hash").notNull(),
  permissions: text().notNull().default("deploy:read"),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at"),
});

export const alerts = sqliteTable("alerts", {
  id: text().primaryKey(),
  projectId: text("project_id").notNull(),
  type: text().notNull(),
  threshold: real(),
  durationSeconds: integer("duration_seconds"),
  channel: text().notNull().default("email"),
  destination: text(),
  enabled: integer().notNull().default(1),
  createdAt: text("created_at").notNull(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], onDelete: "cascade" }),
]);

export const smtpSettings = sqliteTable("smtp_settings", {
  id: text().primaryKey(),
  host: text().notNull(),
  port: integer().notNull().default(587),
  user: text().notNull().default(""),
  passEncrypted: text("pass_encrypted"),
  passIv: text("pass_iv"),
  passTag: text("pass_tag"),
  fromAddress: text("from_address").notNull().default("dequel@localhost"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
