import type {
	Alert,
	ApiKey,
	CreateProjectInput,
	Database,
	Deployment,
	Domain,
	EnvironmentVariable,
	GithubIntegrationStatus,
	GithubRepo,
	Log,
	Project,
	ScalingPolicy,
	Server,
	SmtpSettingsStatus,
	Volume,
} from "../types";

const BASE = "/api";

class ApiError extends Error {
	status: number;
	constructor(msg: string, status: number) {
		super(msg);
		this.status = status;
	}
}

const apiFetch = async <T>(path: string, opts?: RequestInit): Promise<T> => {
	const isFormData = opts?.body instanceof FormData;
	const headers: Record<string, string> = {};
	if (!isFormData) headers["Content-Type"] = "application/json";
	const res = await fetch(`${BASE}${path}`, {
		...opts,
		headers: {
			...headers,
			...(opts?.headers as Record<string, string>),
		},
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({
			message: res.statusText,
		}));
		throw new ApiError(body.message ?? body.error ?? "Request failed", res.status);
	}
	if (res.headers.get("content-type")?.includes("text/event-stream")) return res as unknown as T;
	if (res.headers.get("content-type")?.includes("text/plain")) return res.text() as unknown as T;
	const json = await res.json();
	if (json && typeof json === "object" && "status" in json && "data" in json) return json.data as T;
	return json as T;
};

// Projects
export const listProjects = () => apiFetch<Project[]>("/projects");
export const getProject = (id: string) => apiFetch<Project>(`/projects/${id}`);
export const createProject = (data: CreateProjectInput) =>
	apiFetch<Project>("/projects", {
		method: "POST",
		body: JSON.stringify(data),
	});
export const updateProject = (
	id: string,
	data: Partial<Project> & {
		repoUrl?: string | null;
		repoBranch?: string | null;
		baseDomain?: string | null;
		sourceDir?: string | null;
		port?: number | null;
		projectType?: string;
		buildCommand?: string | null;
		startCommand?: string | null;
	},
) =>
	apiFetch<Project>(`/projects/${id}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});
export const deleteProject = (id: string) =>
	apiFetch<void>(`/projects/${id}`, {
		method: "DELETE",
	});

// Deployments
export const listDeployments = (projectId?: string, offset = 0, limit = 50) => {
	const params = new URLSearchParams();
	if (projectId) params.set("projectId", projectId);
	params.set("offset", String(offset));
	params.set("limit", String(limit));
	return apiFetch<{
		items: Deployment[];
		total: number;
		offset: number;
		limit: number;
	}>(`/deployments?${params.toString()}`);
};
export const getDeployment = (id: string) => apiFetch<Deployment>(`/deployments/${id}`);
export const createDeployment = (form: FormData) =>
	apiFetch<Deployment>("/deployments", {
		method: "POST",
		body: form,
	});
export const rollbackDeployment = (id: string) =>
	apiFetch<Deployment>(`/deployments/${id}/rollback`, { method: "POST" });
export const redeployDeployment = (id: string) =>
	apiFetch<Deployment>(`/deployments/${id}/redeploy`, { method: "POST" });
export const cancelDeployment = (id: string) => apiFetch<void>(`/deployments/${id}/cancel`, { method: "POST" });
export const deleteDeployment = (id: string) => apiFetch<void>(`/deployments/${id}`, { method: "DELETE" });
export const getLogs = (id: string) => apiFetch<Log[]>(`/deployments/${id}/logs`);
export const streamLogsUrl = (id: string) => `${BASE}/deployments/${id}/logs/stream`;
export const getRuntimeLogs = (id: string) => apiFetch<Log[]>(`/deployments/${id}/runtime-logs`);
export const streamRuntimeLogsUrl = (id: string) => `${BASE}/deployments/${id}/runtime-logs/stream`;
export const getRequestLogs = (projectId: string, start?: number | null, end?: number | null) => {
	let url = `/projects/${projectId}/request-logs`;
	const params = new URLSearchParams();
	if (start != null) params.append("start", String(start));
	if (end != null) params.append("end", String(end));
	const qs = params.toString();
	if (qs) url += `?${qs}`;
	return apiFetch<Log[]>(url);
};
export const streamRequestLogsUrl = (projectId: string) => `${BASE}/projects/${projectId}/request-logs/stream`;
export const getProjectRequestMetrics = (projectId: string) =>
	apiFetch<{
		status: string;
		data: {
			resultType: string;
			result: Array<{
				metric: Record<string, string>;
				values: Array<[number, string]>;
			}>;
		};
	}>(`/projects/${projectId}/metrics/requests`);

// Env Vars
export const listEnvVars = (projectId: string, environment?: string) =>
	apiFetch<EnvironmentVariable[]>(`/projects/${projectId}/env-vars${environment ? `?environment=${environment}` : ""}`);
export const createEnvVar = (
	projectId: string,
	data: {
		key: string;
		value: string;
		environment?: string;
	},
) =>
	apiFetch<EnvironmentVariable>(`/projects/${projectId}/env-vars`, {
		method: "POST",
		body: JSON.stringify(data),
	});
export const updateEnvVar = (id: string, value: string) =>
	apiFetch<EnvironmentVariable>(`/env-vars/${id}`, {
		method: "PATCH",
		body: JSON.stringify({ value }),
	});
export const deleteEnvVar = (id: string) =>
	apiFetch<void>(`/env-vars/${id}`, {
		method: "DELETE",
	});
export const revealEnvVar = (id: string) => apiFetch<{ value: string }>(`/env-vars/${id}/reveal`);

// Volumes
export const listVolumes = (projectId: string) => apiFetch<Volume[]>(`/projects/${projectId}/volumes`);
export const createVolume = (projectId: string, mountPath?: string) =>
	apiFetch<Volume>(`/projects/${projectId}/volumes`, {
		method: "POST",
		body: JSON.stringify({ mountPath }),
	});
export const deleteVolume = (id: string) =>
	apiFetch<void>(`/volumes/${id}`, {
		method: "DELETE",
	});

// Databases
export const listAllDatabases = () => apiFetch<Database[]>("/databases");
export const listDatabases = (projectId: string) => apiFetch<Database[]>(`/projects/${projectId}/databases`);
export const createDatabase = (
	projectId: string | null,
	type: string,
	options?: {
		name?: string;
		version?: string;
		cpuLimit?: number | null;
		memoryLimitMb?: number | null;
		storageLimitMb?: number | null;
		publicAccess?: boolean;
		allowPublicAccessFromAnywhere?: boolean;
		allowedCidrs?: string[];
	},
) =>
	apiFetch<Database>(projectId ? `/projects/${projectId}/databases` : "/databases", {
		method: "POST",
		body: JSON.stringify({ type, projectId, ...options }),
	});
export const getDatabase = (id: string) => apiFetch<Database>(`/databases/${id}`);
export const deleteDatabase = (id: string) => apiFetch<void>(`/databases/${id}`, { method: "DELETE" });
export const getDatabaseCredentials = (id: string) =>
	apiFetch<{
		username: string;
		password: string;
		internalConnectionString: string;
		externalConnectionString: string | null;
		externalHost: string | null;
		externalPort: number | null;
	}>(`/databases/${id}/credentials`);
export const startDatabase = (id: string) => apiFetch<Database>(`/databases/${id}/start`, { method: "POST" });
export const stopDatabase = (id: string) => apiFetch<Database>(`/databases/${id}/stop`, { method: "POST" });
export const restartDatabase = (id: string) => apiFetch<Database>(`/databases/${id}/restart`, { method: "POST" });
export const retryDatabase = (id: string) => apiFetch<Database>(`/databases/${id}/retry`, { method: "POST" });

// Domains
export const listDomains = (projectId: string) => apiFetch<Domain[]>(`/projects/${projectId}/domains`);
export const createDomain = (
	projectId: string,
	domain: string,
	type?: string,
	targetService?: string,
	targetPort?: number,
) =>
	apiFetch<Domain>(`/projects/${projectId}/domains`, {
		method: "POST",
		body: JSON.stringify({
			domain,
			type,
			targetService,
			targetPort,
		}),
	});
export const getDomain = (id: string) => apiFetch<Domain>(`/domains/${id}`);
export const deleteDomain = (id: string) =>
	apiFetch<void>(`/domains/${id}`, {
		method: "DELETE",
	});
export const getDomainStatus = (projectId: string) =>
	apiFetch<
		Array<{
			domain: string;
			dnsOk: boolean;
			tlsOk: boolean;
			lastChecked: string;
		}>
	>(`/projects/${projectId}/domains/status`);

// Scaling
export const getScalingPolicy = (projectId: string) => apiFetch<ScalingPolicy>(`/projects/${projectId}/scaling`);
export const upsertScalingPolicy = (projectId: string, data: Partial<ScalingPolicy>) =>
	apiFetch<ScalingPolicy>(`/projects/${projectId}/scaling`, {
		method: "PUT",
		body: JSON.stringify(data),
	});
export const deleteScalingPolicy = (projectId: string) =>
	apiFetch<void>(`/projects/${projectId}/scaling`, { method: "DELETE" });

// Server
export const getServerIp = () =>
	apiFetch<{ ip: string; baseDomain: string; resolves: boolean; url: string }>("/server/ip");

// Auth
export const login = (username: string, password: string) =>
	apiFetch<{ username: string }>("/auth/login", {
		method: "POST",
		body: JSON.stringify({ username, password }),
	});

export const logout = () => apiFetch<void>("/auth/logout", { method: "POST" });

export const refreshSession = () => apiFetch<{ username: string }>("/auth/refresh", { method: "POST" });

export const getMe = async () => {
	const res = await apiFetch<{ authenticated: boolean; username?: string }>("/auth/me");
	if (!res.authenticated) {
		const refreshed = await apiFetch<{ username: string }>("/auth/refresh", { method: "POST" }).catch(() => null);
		if (refreshed) {
			return apiFetch<{ authenticated: boolean; username?: string }>("/auth/me");
		}
	}
	return res;
};

// Prometheus
export const queryPrometheus = (query: string) =>
	apiFetch<{
		status: string;
		data: {
			resultType: string;
			result: Array<{
				metric: Record<string, string>;
				value: [number, string];
			}>;
		};
	}>(`/prometheus/query?query=${encodeURIComponent(query)}`);

export const queryPrometheusRange = (query: string, start: number, end: number, step: string) =>
	apiFetch<{
		status: string;
		data: {
			resultType: string;
			result: Array<{
				metric: Record<string, string>;
				values: Array<[number, string]>;
			}>;
		};
	}>(
		`/prometheus/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${encodeURIComponent(step)}`,
	);

// Metrics
export const getMetrics = async () => {
	try {
		return await apiFetch<string>("/metrics");
	} catch {
		const res = await fetch("/metrics");
		if (!res.ok) throw new ApiError("Metrics request failed", res.status);
		return res.text();
	}
};

// Servers
export const listServers = () => apiFetch<Server[]>("/servers");
export const createServer = (data: {
	name: string;
	host: string;
	port?: number;
	mode?: string;
	sshUser?: string;
	sshKey?: string;
	sshKeyId?: string;
	sshPassword?: string;
	authToken?: string;
}) =>
	apiFetch<Server>("/servers", {
		method: "POST",
		body: JSON.stringify(data),
	});
export const getServer = (id: string) => apiFetch<Server>(`/servers/${id}`);
export const prepareServer = (id: string) =>
	apiFetch<{ preparing: boolean }>(`/servers/${id}/prepare`, {
		method: "POST",
	});
export const serverPrepareStreamUrl = (id: string) => `${BASE}/servers/${id}/prepare/stream`;
export const deleteServer = (id: string) =>
	apiFetch<void>(`/servers/${id}`, {
		method: "DELETE",
	});
export const createAgentRegistrationToken = (data: { name: string; labels?: Record<string, string> }) =>
	apiFetch<{ token: string; expiresAt: string }>("/agents/registration-tokens", {
		method: "POST",
		body: JSON.stringify(data),
	});

// API Keys
export const listApiKeys = () => apiFetch<ApiKey[]>("/api-keys");
export const createApiKey = (data: { name: string; permissions?: string }) =>
	apiFetch<ApiKey>("/api-keys", {
		method: "POST",
		body: JSON.stringify(data),
	});
export const deleteApiKey = (id: string) =>
	apiFetch<void>(`/api-keys/${id}`, {
		method: "DELETE",
	});

// Alerts
export const listAlerts = (projectId: string) => apiFetch<Alert[]>(`/projects/${projectId}/alerts`);
export const createAlert = (projectId: string, data: Partial<Alert>) =>
	apiFetch<Alert>(`/projects/${projectId}/alerts`, {
		method: "POST",
		body: JSON.stringify(data),
	});
export const toggleAlert = (id: string, enabled: boolean) =>
	apiFetch<Alert>(`/alerts/${id}`, {
		method: "PATCH",
		body: JSON.stringify({ enabled }),
	});
export const deleteAlert = (id: string) =>
	apiFetch<void>(`/alerts/${id}`, {
		method: "DELETE",
	});

// ─── GitHub OAuth ───────────────────────────────────────

export const getGithubAuthUrl = () => apiFetch<{ url: string }>("/github/auth-url");

export const getGithubUser = () => apiFetch<{ login: string; avatar_url: string }>("/github/user");

export const getGithubRepos = () => apiFetch<GithubRepo[]>("/github/repos");

export const disconnectGithub = () => apiFetch<void>("/github/disconnect", { method: "POST" });

export const getGithubIntegration = () => apiFetch<GithubIntegrationStatus>("/github/integration");

export const setGithubIntegration = (data: {
	clientId: string;
	clientSecret: string;
	appName?: string;
	webhookSecret?: string;
}) =>
	apiFetch<void>("/github/integration", {
		method: "PUT",
		body: JSON.stringify(data),
	});

export const getSmtpSettings = () => apiFetch<SmtpSettingsStatus>("/settings/smtp");

export const setSmtpSettings = (data: {
	host: string;
	port: number;
	user?: string;
	pass?: string;
	fromAddress?: string;
}) =>
	apiFetch<void>("/settings/smtp", {
		method: "PUT",
		body: JSON.stringify(data),
	});

export const testSmtpSettings = () =>
	apiFetch<void>("/settings/smtp/test", {
		method: "POST",
	});

// ─── GitHub Webhook ───────────────────────────────────────

export const getRepoHooks = (owner: string, repo: string) =>
	apiFetch<Array<{ id: number; url: string; active: boolean; events: string[] }>>(
		`/github/repos/${owner}/${repo}/hooks`,
	);

export const registerRepoHook = (owner: string, repo: string) =>
	apiFetch<{ id: number; created: boolean; url: string }>(`/github/repos/${owner}/${repo}/hook`, {
		method: "POST",
	});

export const removeRepoHook = (owner: string, repo: string) =>
	apiFetch<{ removed: boolean }>(`/github/repos/${owner}/${repo}/hook`, {
		method: "DELETE",
	});

export const setEnvVar = (projectId: string, key: string, value: string, environment?: string) =>
	createEnvVar(projectId, { key, value, environment });

export const uploadSourceZip = (file: File) => {
	const formData = new FormData();
	formData.append("file", file);
	return apiFetch<{ filePath: string }>("/upload", {
		method: "POST",
		body: formData,
	});
};

// Shared Environment Variables
export const listSharedEnvVars = (environment?: string) =>
	apiFetch<any[]>(`/shared-env-vars${environment ? `?environment=${environment}` : ""}`);
export const createSharedEnvVar = (data: {
	key: string;
	value: string;
	environment?: string;
	description?: string;
	tags?: string[];
}) => apiFetch<any>("/shared-env-vars", { method: "POST", body: JSON.stringify(data) });
export const updateSharedEnvVar = (id: string, value: string) =>
	apiFetch<any>(`/shared-env-vars/${id}`, { method: "PATCH", body: JSON.stringify({ value }) });
export const revealSharedEnvVar = (id: string) => apiFetch<{ value: string }>(`/shared-env-vars/${id}/reveal`);
export const deleteSharedEnvVar = (id: string) => apiFetch<void>(`/shared-env-vars/${id}`, { method: "DELETE" });
export const listLinkedSharedEnvVars = (projectId: string) =>
	apiFetch<any[]>(`/projects/${projectId}/shared-env-links`);
export const linkSharedEnvVars = (projectId: string, sharedEnvVarIds: string[]) =>
	apiFetch<void>(`/projects/${projectId}/shared-env-links`, {
		method: "POST",
		body: JSON.stringify({ sharedEnvVarIds }),
	});
export const unlinkSharedEnvVar = (projectId: string, linkId: string) =>
	apiFetch<void>(`/projects/${projectId}/shared-env-links/${linkId}`, { method: "DELETE" });

// SSH Key Pool
export const listSshKeys = () => apiFetch<any[]>("/ssh-keys");
export const createSshKey = (data: { name: string; privateKey: string; tags?: string[] }) =>
	apiFetch<any>("/ssh-keys", { method: "POST", body: JSON.stringify(data) });
export const deleteSshKey = (id: string) => apiFetch<void>(`/ssh-keys/${id}`, { method: "DELETE" });
