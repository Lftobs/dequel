export type DeploymentStatus = 'pending' | 'building' | 'deploying' | 'running' | 'failed' | 'inactive';
export type SourceType = 'git' | 'upload' | 'image' | 'compose';
export type LogStage = 'build' | 'deploy' | 'system';
export type DatabaseType = 'postgresql' | 'mysql' | 'redis' | 'mongodb';
export type DatabaseStatus = 'provisioning' | 'running' | 'stopped' | 'restarting' | 'deleting' | 'deletion_failed' | 'failed';
export type DomainType = 'base' | 'custom';
export type DomainValidationStatus = 'pending' | 'verified' | 'failed';
export type SslStatus = 'pending' | 'provisioned' | 'failed';
export type ServerStatus = 'pending' | 'connected' | 'disconnected' | 'failed';
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
  composeService?: string | null;
  composePort?: number | null;
  composeServices?: string | null;
  buildCommand: string | null;
  installCommand?: string | null;
  outputDir?: string | null;
  startCommand: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  serverId?: string | null;
  description?: string;
  baseDomain?: string;
  repoUrl?: string;
  repoBranch?: string;
  cpuLimit?: number;
  memoryLimitMb?: number;
  port?: number | null;
  sourceDir?: string;
  sourceType?: string;
  projectType?: string;
  buildType?: string;
  buildCommand?: string | null;
  installCommand?: string | null;
  outputDir?: string | null;
  startCommand?: string | null;
  composeService?: string | null;
  composePort?: number | null;
  composeServices?: string | null;
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
  finishedAt: string | null;
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
  mode: 'local' | 'ssh' | 'agent';
  sshUser?: string | null;
  agentId: string | null;
  agentVersion: string | null;
  peerIp: string | null;
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

export type AiProvider = 'openai' | 'gemini' | 'grok' | 'claude';

export interface AiFixSuggestion {
  title: string;
  description: string;
  actionType?: 'command' | 'code' | 'config' | 'env';
  snippet?: string;
}

export interface AiDiagnosis {
  id?: string;
  deploymentId: string;
  provider: AiProvider;
  model: string;
  summary: string;
  rootCause: string;
  explanation: string;
  suggestedFixes: AiFixSuggestion[];
  rawResponse?: string | null;
  createdAt?: string;
}

export interface AiSettingsStatus {
  defaultProvider: AiProvider;
  openaiConfigured: boolean;
  openaiModel: string;
  geminiConfigured: boolean;
  geminiModel: string;
  grokConfigured: boolean;
  grokModel: string;
  claudeConfigured: boolean;
  claudeModel: string;
}

export interface AiSettingsInput {
  defaultProvider?: AiProvider;
  openaiApiKey?: string;
  openaiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  grokApiKey?: string;
  grokModel?: string;
  claudeApiKey?: string;
  claudeModel?: string;
}

