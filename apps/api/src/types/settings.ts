export type AlertChannel = "email" | "slack" | "webhook";
export type AlertType = "cpu" | "memory" | "downtime" | "cert_expiry";

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

export type MailDelivery =
	| { status: "sent" }
	| { status: "skipped"; reason: "no_smtp" | "no_recipient" }
	| { status: "failed"; error: string };

export type HealthStatus = "ok" | "warn" | "fail" | "unknown";
export type OverallHealth = "healthy" | "degraded" | "down";

export interface HealthCheck {
	name: "server" | "containers" | "ingress" | "http";
	status: HealthStatus;
	detail: string | null;
}

export interface StatusFailure {
	deploymentId: string;
	message: string | null;
	commitSha: string | null;
	sourceRef: string;
	finishedAt: string | null;
	recovered: boolean;
	notifiedAt: string | null;
}

export interface StatusHistoryEntry {
	deploymentId: string;
	type: string;
	message: string | null;
	at: string;
}

export interface HttpErrorRate {
	source: "loki";
	available: boolean;
	windowSeconds: number;
	totalRequests: number;
	errorRequests: number;
	errorRate: number | null;
	byStatus: { status: string; count: number }[];
}

export interface ProjectStatus {
	projectId: string;
	windowSeconds: number;
	health: { overall: OverallHealth; checks: HealthCheck[] };
	failures: StatusFailure[];
	history: StatusHistoryEntry[];
	replicas: { current: number } | null;
	resources: {
		server: {
			status: string;
			cpuUsedPercent: number | null;
			memoryTotalMb: number | null;
			lastHeartbeatAt: string | null;
		} | null;
		containers: { name: string; cpuPercent: number; memoryMb: number }[];
	};
	http: HttpErrorRate;
}
