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
  createdAt: string;
  updatedAt: string;
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

export interface EnvironmentVariable {
  id: string;
  projectId: string;
  key: string;
  value: string | null;
  environment: string;
  createdAt: string;
  updatedAt: string;
}

export interface Volume {
  id: string;
  projectId: string;
  mountPath: string;
  sizeMb: number | null;
  dockerVolumeName: string | null;
  createdAt: string;
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

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  permissions: string;
  rawKey?: string;
  createdAt: string;
  lastUsedAt: string | null;
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

export interface Log {
  id: number;
  deploymentId: string;
  sequence: number;
  stage: LogStage;
  message: string;
  createdAt: string;
}

export interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  cloneUrl: string;
  sshUrl: string;
  description: string | null;
  language: string | null;
  private: boolean;
  defaultBranch: string;
  owner: { login: string; avatarUrl: string };
}

export interface SmtpSettingsStatus {
  configured: boolean;
  host?: string;
  port?: number;
  user?: string;
  fromAddress?: string;
}

export interface GithubIntegrationStatus {
  configured: boolean;
  clientId?: string;
  appName?: string;
  hasWebhookSecret?: boolean;
}
