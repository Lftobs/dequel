export type DeploymentStatus = "pending" | "building" | "deploying" | "running" | "failed" | "inactive";
export type SourceType = "git" | "upload" | "image" | "compose";
export type LogStage = "build" | "deploy" | "system";

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

export type FailureSource = "pipeline" | "rollback" | "ssh" | "agent" | "job-channel" | "reconciler" | "dispatch";

export interface RecordFailureInput {
	deploymentId: string;
	reason: string;
	source: FailureSource;
	cancel?: boolean;
}

export interface RecordFailureOutcome {
	claimed: boolean;
	eventId: string | null;
}

export interface FailureNotificationContext {
	eventId: string;
	deploymentId: string;
	projectId: string | null;
	projectName: string;
	failureReason: string | null;
	commitSha: string | null;
	sourceRef: string;
	finishedAt: string | null;
	attempt: number;
}
