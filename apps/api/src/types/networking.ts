export type DomainType = "base" | "custom";
export type DomainValidationStatus = "pending" | "verified" | "failed";
export type SslStatus = "pending" | "provisioned" | "failed";
export type DomainTlsMode = "auto" | "custom" | "dns";

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
	tlsMode: DomainTlsMode;
	hasCustomCertificate: boolean;
	basicAuthUser: string | null;
	hasBasicAuthPassword: boolean;
	httpsRedirect: boolean;
	gzip: boolean;
	noindex: boolean;
	wwwRedirect: boolean;
	pathPrefix: string | null;
	stripPrefix: boolean;
	rawSnippet: string | null;
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
	tlsMode?: DomainTlsMode;
	certificate?: string | null;
	certificateKey?: string | null;
	basicAuthUser?: string | null;
	basicAuthPassword?: string | null;
	httpsRedirect?: boolean;
	gzip?: boolean;
	noindex?: boolean;
	wwwRedirect?: boolean;
	pathPrefix?: string | null;
	stripPrefix?: boolean;
	rawSnippet?: string | null;
}

export type NotificationEvent =
	| "deployment_failed"
	| "deployment_succeeded"
	| "backup_failed"
	| "backup_succeeded"
	| "server_offline"
	| "alert";

export interface NotificationChannel {
	id: string;
	name: string;
	channel: string;
	destination: string | null;
	enabled: boolean;
	events: NotificationEvent[];
	createdAt: string;
	updatedAt: string;
}

export interface Registry {
	id: string;
	name: string;
	serverId: string | null;
	url: string;
	username: string;
	hasPassword: boolean;
	createdAt: string;
	updatedAt: string;
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
