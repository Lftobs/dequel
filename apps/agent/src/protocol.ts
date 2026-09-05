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

export type AgentMessage =
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

export const serializeAgentMessage = (message: AgentMessage): string => JSON.stringify(message);

export const parseP2PResponse = (raw: unknown): P2PResponse | null => {
	try {
		const value = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (!value || typeof value !== "object" || value.ok !== true) return null;
		if (typeof value.serverId !== "string" || typeof value.heartbeatIntervalMs !== "number") return null;
		if (!Array.isArray(value.jobs) || !Array.isArray(value.cancelJobIds)) return null;
		return value as P2PResponse;
	} catch {
		return null;
	}
};
