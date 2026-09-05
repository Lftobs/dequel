export type DeploymentStatus = 'pending' | 'building' | 'deploying' | 'running' | 'failed' | 'inactive';
export type SourceType = 'git' | 'upload' | 'image' | 'compose';
export type LogStage = 'build' | 'deploy' | 'system';
export type DatabaseType = 'postgresql' | 'mysql' | 'redis' | 'mongodb';
export type DatabaseStatus = 'provisioning' | 'running' | 'stopped' | 'restarting' | 'deleting' | 'deletion_failed' | 'failed';
export type DomainType = 'base' | 'custom';
export type DomainValidationStatus = 'pending' | 'verified' | 'failed';
export type SslStatus = 'pending' | 'provisioned' | 'failed';
export type ServerStatus = 'pending' | 'connected' | 'disconnected' | 'failed';
export type ServerMode = 'local' | 'ssh' | 'agent' | 'docker_tcp';
export type AlertChannel = 'email' | 'slack' | 'webhook';
export type AlertType = 'cpu' | 'memory' | 'error_rate' | 'downtime' | 'cert_expiry';

export interface Project {
  id: string;
  serverId: string | null;
  name: string;
  description: string | null;
  repoUrl: string | null;
  repoBranch: string | null;
  baseDomain: string | null;
  cpuLimit: number | null;
  memoryLimitMb: number | null;
  port: number | null;
  sourceDir: string | null;
  sourceType: string;
  projectType: string;
  buildType: string;
  composeService: string | null;
  composePort: number | null;
  composeServices: string | null;
  buildCommand: string | null;
  installCommand: string | null;
  outputDir: string | null;
  startCommand: string | null;
  githubTokenEncrypted: string | null;
  githubTokenIv: string | null;
  githubTokenTag: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GithubIntegration {
  id: string;
  clientId: string;
  clientSecret: string;
  appName: string;
  webhookSecret: string | null;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
  serverId?: string | null;
  description?: string;
  repoUrl?: string;
  repoBranch?: string;
  baseDomain?: string;
  cpuLimit?: number | null;
  memoryLimitMb?: number | null;
  port?: number | null;
  sourceDir?: string | null;
  sourceType?: string;
  projectType?: string;
  buildType?: string;
  composeService?: string | null;
  composePort?: number | null;
  composeServices?: string | null;
  buildCommand?: string | null;
  installCommand?: string | null;
  outputDir?: string | null;
  startCommand?: string | null;
}

export interface EnvironmentVariable {
  id: string;
  projectId: string;
  key: string;
  value: string;
  environment: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnvironmentVariableInput {
  projectId: string;
  key: string;
  value: string;
  environment?: string;
}

export interface Volume {
  id: string;
  projectId: string;
  mountPath: string;
  sizeMb: number | null;
  dockerVolumeName: string | null;
  createdAt: string;
}

export interface CreateVolumeInput {
  projectId: string;
  mountPath?: string;
}

export interface Database {
  id: string;
  projectId: string | null;
  name: string;
  type: DatabaseType;
  version: string | null;
  databaseName: string;
  username: string;
  password: string;
  internalHost: string;
  internalPort: number;
  cpuLimit: number | null;
  memoryLimitMb: number | null;
  storageLimitMb: number | null;
  storageUsedMb: number;
  publicAccess: boolean;
  allowPublicAccessFromAnywhere: boolean;
  allowedCidrs: string[];
  externalPort: number | null;
  proxyContainerName: string | null;
  volumeName: string;
  connectionString: string;
  status: DatabaseStatus;
  containerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDatabaseInput {
  projectId?: string | null;
  name: string;
  type: DatabaseType;
  version?: string;
  cpuLimit?: number | null;
  memoryLimitMb?: number | null;
  storageLimitMb?: number | null;
  publicAccess?: boolean;
  allowPublicAccessFromAnywhere?: boolean;
  allowedCidrs?: string[];
}

export interface Domain {
  id: string;
  projectId: string;
  domain: string;
  type: DomainType;
  validationStatus: DomainValidationStatus;
  sslStatus: SslStatus;
  targetService: string | null;
  targetPort: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDomainInput {
  projectId: string;
  domain: string;
  type: DomainType;
  targetService?: string | null;
  targetPort?: number | null;
}

export interface ScalingPolicy {
  id: string;
  projectId: string;
  minReplicas: number;
  maxReplicas: number;
  cpuThresholdPercent: number;
  memoryThresholdPercent: number;
  cooldownSeconds: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScalingPolicyInput {
  projectId: string;
  minReplicas?: number;
  maxReplicas?: number;
  cpuThresholdPercent?: number;
  memoryThresholdPercent?: number;
  cooldownSeconds?: number;
  enabled?: boolean;
}

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  mode: ServerMode;
  sshUser?: string | null;
  sshKey?: string | null;
  sshKeyId?: string | null;
  sshPassword?: string | null;
  sshKeyEncrypted?: string | null;
  agentId: string | null;
  agentVersion: string | null;
  capabilities: Record<string, unknown>;
  labels: Record<string, string>;
  status: ServerStatus;
  cpuTotal: number | null;
  memoryTotalMb: number | null;
  diskTotalMb: number | null;
  cpuUsedPercent: number | null;
  memoryUsedMb: number | null;
  lastHeartbeat: string | null;
  registeredAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServerInput {
  name: string;
  host: string;
  port?: number;
  authToken?: string;
  mode?: ServerMode;
  sshUser?: string;
  sshKey?: string;
  sshKeyId?: string;
  sshPassword?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  permissions: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreateApiKeyInput {
  name: string;
  permissions?: string;
}

export interface Alert {
  id: string;
  projectId: string;
  type: AlertType;
  threshold: number | null;
  durationSeconds: number | null;
  channel: AlertChannel;
  destination: string | null;
  enabled: boolean;
  createdAt: string;
}

export interface CreateAlertInput {
  projectId: string;
  type: AlertType;
  threshold?: number;
  durationSeconds?: number;
  channel: AlertChannel;
  destination?: string;
}

export interface Deployment {
  id: string;
  projectId: string | null;
  serverId: string | null;
  sourceType: SourceType;
  sourceRef: string;
  status: DeploymentStatus;
  imageTag: string | null;
  containerName: string | null;
  routePath: string | null;
  liveUrl: string | null;
  branch: string | null;
  commitSha: string | null;
  replicas: number;
  environment: string | null;
  failureReason: string | null;
  clearCache: boolean;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface CreateDeploymentInput {
  projectId?: string;
  serverId?: string | null;
  sourceType: SourceType;
  sourceRef: string;
  branch?: string;
  commitSha?: string;
  environment?: string;
  clearCache?: boolean;
}

export interface DeploymentLog {
  id: number;
  deploymentId: string;
  sequence: number;
  stage: LogStage;
  message: string;
  createdAt: string;
}

export interface LogEvent {
  deploymentId: string;
  sequence: number;
  stage: LogStage;
  message: string;
  timestamp: string;
}

export type RouteStatus = 'pending' | 'active' | 'failed' | 'removed';

export interface Route {
  id: string;
  serverId: string | null;
  deploymentId: string | null;
  projectId: string | null;
  hostname: string;
  routeFile: string;
  port: number;
  targetContainers: string[];
  upstreamHost: string | null;
  status: RouteStatus;
  lastError: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertRouteInput {
  serverId?: string | null;
  deploymentId?: string | null;
  projectId?: string | null;
  hostname: string;
  routeFile: string;
  port: number;
  targetContainers: string[];
  upstreamHost?: string | null;
  status?: RouteStatus;
  lastError?: string | null;
}

export interface SharedEnvVar {
  id: string;
  key: string;
  value: string;
  environment: string;
  description: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSharedEnvVarInput {
  key: string;
  value: string;
  environment?: string;
  description?: string;
  tags?: string[];
}

export interface SshKey {
  id: string;
  name: string;
  fingerprint: string;
  publicKey: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSshKeyInput {
  name: string;
  privateKey: string;
  tags?: string[];
}

export interface Permission {
  action: string;
  resource: string;
}

export interface AuthContext {
  type: "session" | "api-key";
  apiKeyId?: string;
  permissions?: Permission[];
}
