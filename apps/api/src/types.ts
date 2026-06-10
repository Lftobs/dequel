export type DeploymentStatus = 'pending' | 'building' | 'deploying' | 'running' | 'failed' | 'inactive';
export type SourceType = 'git' | 'upload' | 'image' | 'compose';
export type LogStage = 'build' | 'deploy' | 'system';
export type DatabaseType = 'postgresql' | 'mysql';
export type DatabaseStatus = 'provisioning' | 'running' | 'failed';
export type DomainType = 'base' | 'custom';
export type DomainValidationStatus = 'pending' | 'verified' | 'failed';
export type SslStatus = 'pending' | 'provisioned' | 'failed';
export type ServerStatus = 'pending' | 'connected' | 'disconnected' | 'failed';
export type AlertChannel = 'email' | 'slack' | 'webhook';
export type AlertType = 'cpu' | 'memory' | 'error_rate' | 'downtime' | 'cert_expiry';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  repoUrl: string | null;
  repoBranch: string | null;
  baseDomain: string | null;
  cpuLimit: number | null;
  memoryLimitMb: number | null;
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
  description?: string;
  repoUrl?: string;
  repoBranch?: string;
  baseDomain?: string;
  cpuLimit?: number | null;
  memoryLimitMb?: number | null;
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
  projectId: string;
  type: DatabaseType;
  version: string | null;
  databaseName: string;
  username: string;
  password: string;
  internalHost: string;
  internalPort: number;
  cpuLimit: number | null;
  memoryLimitMb: number | null;
  connectionString: string;
  status: DatabaseStatus;
  containerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDatabaseInput {
  projectId: string;
  type: DatabaseType;
  version?: string;
  cpuLimit?: number | null;
  memoryLimitMb?: number | null;
}

export interface Domain {
  id: string;
  projectId: string;
  domain: string;
  type: DomainType;
  validationStatus: DomainValidationStatus;
  sslStatus: SslStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDomainInput {
  projectId: string;
  domain: string;
  type: DomainType;
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
}

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  authToken: string;
  status: ServerStatus;
  cpuTotal: number | null;
  memoryTotalMb: number | null;
  diskTotalMb: number | null;
  cpuUsedPercent: number | null;
  memoryUsedMb: number | null;
  lastHeartbeat: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServerInput {
  name: string;
  host: string;
  port?: number;
  authToken: string;
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
  sourceType: SourceType;
  sourceRef: string;
  branch?: string;
  commitSha?: string;
  environment?: string;
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
