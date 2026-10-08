export type DomainType = "base" | "custom";
export type DomainValidationStatus = "pending" | "verified" | "failed";
export type SslStatus = "pending" | "provisioned" | "failed";

export interface Domain {
	id: string;
	projectId: string;
	domain: string;
	type: DomainType;
	validationStatus: DomainValidationStatus;
	sslStatus: SslStatus;
	targetService: string | null;
	targetPort: number | null;
	cloudflareProxied: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CreateDomainInput {
	projectId: string;
	domain: string;
	type: DomainType;
	targetService?: string | null;
	targetPort?: number | null;
	cloudflareProxied?: boolean;
}

export type RouteStatus = "pending" | "active" | "failed" | "removed";

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
