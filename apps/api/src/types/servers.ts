export type ServerStatus = "pending" | "connected" | "disconnected" | "failed";
export type ServerMode = "local" | "ssh" | "agent" | "docker_tcp";

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
