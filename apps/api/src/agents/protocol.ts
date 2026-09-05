export const AGENT_PROTOCOL_VERSION = 1 as const;

export type AgentCapabilities = {
	docker: boolean;
	buildkit: boolean;
	caddy: boolean;
	compose: boolean;
	architectures: string[];
	cpuCount: number;
	memoryBytes: number;
	diskBytes: number;
};

export type AgentContainerStat = {
	containerName: string;
	cpuPercent: number;
	memoryMb: number;
	projectId?: string;
	replica?: boolean;
};

export type P2PAgentRequest =
	| {
			type: "p2p_heartbeat";
			protocolVersion: 1;
			credential: string;
			agentVersion: string;
			capabilities: AgentCapabilities;
			resources?: { cpuUsedPercent?: number; memoryUsedMb?: number };
			containers?: AgentContainerStat[];
	  }
	| { type: "job_ack"; protocolVersion: 1; credential: string; jobId: string; leaseId: string }
	| {
			type: "job_progress";
			protocolVersion: 1;
			credential: string;
			jobId: string;
			leaseId: string;
			stage: string;
			message: string;
	  }
	| {
			type: "job_result";
			protocolVersion: 1;
			credential: string;
			jobId: string;
			leaseId: string;
			success: boolean;
			result?: unknown;
			error?: string;
	  };

export type P2PResponse = {
	ok: true;
	serverId: string;
	heartbeatIntervalMs: number;
	jobs: AgentJobEnvelope[];
	cancelJobIds: string[];
};

export type AgentJobEnvelope = {
	id: string;
	deploymentId: string | null;
	type: "deploy" | "rollback" | "scale" | "destroy" | "reload_routes";
	payload: unknown;
	leaseId: string;
	leaseExpiresAt: string;
	idempotencyKey: string;
};

export type RemoteGitDeployPayload = {
	deploymentId: string;
	projectId: string;
	projectName: string;
	gitUrl: string;
	branch?: string;
	commitSha?: string;
	appPort: number;
	cpuLimit?: number;
	memoryLimitMb?: number;
	environmentVariables: { key: string; value: string }[];
};

export type RemoteDeployResult = {
	imageTag: string;
	containerName: string;
	hostPort: number;
	liveUrl: string | null;
	commitSha: string | null;
};

export const isRemoteDeployResult = (value: unknown): value is RemoteDeployResult => {
	if (!isRecord(value)) return false;
	return (
		typeof value.imageTag === "string" &&
		typeof value.containerName === "string" &&
		typeof value.hostPort === "number" &&
		(value.liveUrl === null || typeof value.liveUrl === "string") &&
		(value.commitSha === null || typeof value.commitSha === "string")
	);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isCapabilities = (value: unknown): value is AgentCapabilities => {
	if (!isRecord(value)) return false;
	return (
		["docker", "buildkit", "caddy", "compose"].every((key) => typeof value[key] === "boolean") &&
		Array.isArray(value.architectures) &&
		value.architectures.every((item) => typeof item === "string") &&
		["cpuCount", "memoryBytes", "diskBytes"].every((key) => typeof value[key] === "number")
	);
};

export const parseP2PAgentRequest = (raw: unknown): P2PAgentRequest | null => {
	let value: unknown = raw;
	if (typeof raw === "string") {
		try {
			value = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	if (!isRecord(value) || value.protocolVersion !== AGENT_PROTOCOL_VERSION || typeof value.type !== "string")
		return null;
	if (typeof value.credential !== "string") return null;
	if (value.type === "p2p_heartbeat") {
		if (typeof value.agentVersion !== "string" || !isCapabilities(value.capabilities)) return null;
		if (value.resources !== undefined) {
			if (!isRecord(value.resources)) return null;
			const r = value.resources;
			if (r.cpuUsedPercent !== undefined && typeof r.cpuUsedPercent !== "number") return null;
			if (r.memoryUsedMb !== undefined && typeof r.memoryUsedMb !== "number") return null;
		}
		if (value.containers !== undefined) {
			if (!Array.isArray(value.containers)) return null;
			for (const c of value.containers) {
				if (
					!isRecord(c) ||
					typeof c.containerName !== "string" ||
					typeof c.cpuPercent !== "number" ||
					typeof c.memoryMb !== "number"
				)
					return null;
			}
		}
		return value as P2PAgentRequest;
	}
	if (value.type === "job_ack")
		return typeof value.jobId === "string" && typeof value.leaseId === "string" ? (value as P2PAgentRequest) : null;
	if (value.type === "job_progress") {
		return typeof value.jobId === "string" &&
			typeof value.leaseId === "string" &&
			typeof value.stage === "string" &&
			typeof value.message === "string"
			? (value as P2PAgentRequest)
			: null;
	}
	if (value.type === "job_result") {
		return typeof value.jobId === "string" &&
			typeof value.leaseId === "string" &&
			typeof value.success === "boolean" &&
			(value.error === undefined || typeof value.error === "string")
			? (value as P2PAgentRequest)
			: null;
	}
	return null;
};

export const serializeP2PResponse = (response: P2PResponse): string => JSON.stringify(response);
