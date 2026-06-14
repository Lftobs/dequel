import type {
	Project,
	Deployment,
	EnvironmentVariable,
	Volume,
	Database,
	Domain,
	ScalingPolicy,
	Server,
	ApiKey,
	Alert,
	Log,
	GithubRepo,
	GithubIntegrationStatus,
	SmtpSettingsStatus,
} from "../types";

const BASE = "/api";

class ApiError extends Error {
	status: number;
	constructor(msg: string, status: number) {
		super(msg);
		this.status = status;
	}
}

const apiFetch = async <T>(
	path: string,
	opts?: RequestInit,
): Promise<T> => {
	const isFormData =
		opts?.body instanceof FormData;
	const headers: Record<string, string> = {};
	if (!isFormData)
		headers["Content-Type"] =
			"application/json";
	const res = await fetch(`${BASE}${path}`, {
		...opts,
		headers: {
			...headers,
			...(opts?.headers as Record<
				string,
				string
			>),
		},
	});
	if (!res.ok) {
		const body = await res
			.json()
			.catch(() => ({
				error: res.statusText,
			}));
		throw new ApiError(
			body.error ?? "Request failed",
			res.status,
		);
	}
	if (
		res.headers
			.get("content-type")
			?.includes("text/event-stream")
	)
		return res as unknown as T;
	if (
		res.headers
			.get("content-type")
			?.includes("text/plain")
	)
		return res.text() as unknown as T;
	return res.json();
};

// Projects
export const listProjects = () =>
	apiFetch<Project[]>("/projects");
export const getProject = (id: string) =>
	apiFetch<Project>(`/projects/${id}`);
export const createProject = (data: {
	name: string;
	description?: string;
	baseDomain?: string;
	repoUrl?: string;
	repoBranch?: string;
	cpuLimit?: number;
	memoryLimitMb?: number;
	port?: number;
	sourceDir?: string;
	sourceType?: string;
}) =>
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
	},
) =>
	apiFetch<Project>(`/projects/${id}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});
export const deleteProject = (id: string) =>
	apiFetch<{ ok: boolean }>(`/projects/${id}`, {
		method: "DELETE",
	});

// Deployments
export const listDeployments = (
	projectId?: string,
	offset = 0,
	limit = 50,
) => {
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
export const getDeployment = (id: string) =>
	apiFetch<Deployment>(`/deployments/${id}`);
export const createDeployment = (
	form: FormData,
) =>
	apiFetch<Deployment>("/deployments", {
		method: "POST",
		body: form,
	});
export const rollbackDeployment = (id: string) =>
	apiFetch<Deployment>(
		`/deployments/${id}/rollback`,
		{ method: "POST" },
	);
export const redeployDeployment = (id: string) =>
	apiFetch<Deployment>(
		`/deployments/${id}/redeploy`,
		{ method: "POST" },
	);
export const cancelDeployment = (id: string) =>
	apiFetch<{ ok: boolean }>(
		`/deployments/${id}/cancel`,
		{ method: "POST" },
	);
export const deleteDeployment = (id: string) =>
	apiFetch<{ ok: boolean }>(
		`/deployments/${id}`,
		{ method: "DELETE" },
	);
export const getLogs = (id: string) =>
	apiFetch<Log[]>(`/deployments/${id}/logs`);
export const streamLogsUrl = (id: string) =>
	`${BASE}/deployments/${id}/logs/stream`;
export const getRuntimeLogs = (id: string) =>
	apiFetch<Log[]>(
		`/deployments/${id}/runtime-logs`,
	);
export const streamRuntimeLogsUrl = (
	id: string,
) =>
	`${BASE}/deployments/${id}/runtime-logs/stream`;
export const getRequestLogs = (projectId: string, start?: number | null, end?: number | null) => {
	let url = `/projects/${projectId}/request-logs`;
	const params = new URLSearchParams();
	if (start != null) params.append("start", String(start));
	if (end != null) params.append("end", String(end));
	const qs = params.toString();
	if (qs) url += `?${qs}`;
	return apiFetch<Log[]>(url);
};
export const streamRequestLogsUrl = (projectId: string) =>
	`${BASE}/projects/${projectId}/request-logs/stream`;
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
export const listEnvVars = (
	projectId: string,
	environment?: string,
) =>
	apiFetch<EnvironmentVariable[]>(
		`/projects/${projectId}/env-vars${environment ? `?environment=${environment}` : ""}`,
	);
export const createEnvVar = (
	projectId: string,
	data: {
		key: string;
		value: string;
		environment?: string;
	},
) =>
	apiFetch<EnvironmentVariable>(
		`/projects/${projectId}/env-vars`,
		{
			method: "POST",
			body: JSON.stringify(data),
		},
	);
export const updateEnvVar = (
	id: string,
	value: string,
) =>
	apiFetch<EnvironmentVariable>(
		`/env-vars/${id}`,
		{
			method: "PATCH",
			body: JSON.stringify({ value }),
		},
	);
export const deleteEnvVar = (id: string) =>
	apiFetch<{ ok: boolean }>(`/env-vars/${id}`, {
		method: "DELETE",
	});
export const revealEnvVar = (id: string) =>
	apiFetch<{ value: string }>(`/env-vars/${id}/reveal`);

// Volumes
export const listVolumes = (projectId: string) =>
	apiFetch<Volume[]>(
		`/projects/${projectId}/volumes`,
	);
export const createVolume = (
	projectId: string,
	mountPath?: string,
) =>
	apiFetch<Volume>(
		`/projects/${projectId}/volumes`,
		{
			method: "POST",
			body: JSON.stringify({ mountPath }),
		},
	);
export const deleteVolume = (id: string) =>
	apiFetch<{ ok: boolean }>(`/volumes/${id}`, {
		method: "DELETE",
	});

// Databases
export const listDatabases = (
	projectId: string,
) =>
	apiFetch<Database[]>(
		`/projects/${projectId}/databases`,
	);
export const createDatabase = (
	projectId: string,
	type: string,
	options?: {
		version?: string;
		cpuLimit?: number | null;
		memoryLimitMb?: number | null;
	},
) =>
	apiFetch<Database>(
		`/projects/${projectId}/databases`,
		{
			method: "POST",
			body: JSON.stringify({ type, ...options }),
		},
	);
export const getDatabase = (id: string) =>
	apiFetch<Database>(`/databases/${id}`);
export const deleteDatabase = (id: string) =>
	apiFetch<{ ok: boolean }>(
		`/databases/${id}`,
		{ method: "DELETE" },
	);

// Domains
export const listDomains = (projectId: string) =>
	apiFetch<Domain[]>(
		`/projects/${projectId}/domains`,
	);
export const createDomain = (
	projectId: string,
	domain: string,
	type?: string,
) =>
	apiFetch<Domain>(
		`/projects/${projectId}/domains`,
		{
			method: "POST",
			body: JSON.stringify({
				domain,
				type,
			}),
		},
	);
export const getDomain = (id: string) =>
	apiFetch<Domain>(`/domains/${id}`);
export const deleteDomain = (id: string) =>
	apiFetch<{ ok: boolean }>(`/domains/${id}`, {
		method: "DELETE",
	});

// Scaling
export const getScalingPolicy = (
	projectId: string,
) =>
	apiFetch<ScalingPolicy>(
		`/projects/${projectId}/scaling`,
	);
export const upsertScalingPolicy = (
	projectId: string,
	data: Partial<ScalingPolicy>,
) =>
	apiFetch<ScalingPolicy>(
		`/projects/${projectId}/scaling`,
		{
			method: "PUT",
			body: JSON.stringify(data),
		},
	);
export const deleteScalingPolicy = (
	projectId: string,
) =>
	apiFetch<{ ok: boolean }>(
		`/projects/${projectId}/scaling`,
		{ method: "DELETE" },
	);

// Server
export const getServerIp = () =>
	apiFetch<{ ip: string }>("/server/ip");

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
	}>(
		`/prometheus/query?query=${encodeURIComponent(query)}`,
	);

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
		if (!res.ok)
			throw new ApiError(
				"Metrics request failed",
				res.status,
			);
		return res.text();
	}
};

// Servers
export const listServers = () =>
	apiFetch<Server[]>("/servers");
export const createServer = (data: {
	name: string;
	host: string;
	port?: number;
	authToken: string;
}) =>
	apiFetch<Server>("/servers", {
		method: "POST",
		body: JSON.stringify(data),
	});
export const getServer = (id: string) =>
	apiFetch<Server>(`/servers/${id}`);
export const deleteServer = (id: string) =>
	apiFetch<{ ok: boolean }>(`/servers/${id}`, {
		method: "DELETE",
	});

// API Keys
export const listApiKeys = () =>
	apiFetch<ApiKey[]>("/api-keys");
export const createApiKey = (data: {
	name: string;
	permissions?: string;
}) =>
	apiFetch<ApiKey>("/api-keys", {
		method: "POST",
		body: JSON.stringify(data),
	});
export const deleteApiKey = (id: string) =>
	apiFetch<{ ok: boolean }>(`/api-keys/${id}`, {
		method: "DELETE",
	});

// Alerts
export const listAlerts = (projectId: string) =>
	apiFetch<Alert[]>(
		`/projects/${projectId}/alerts`,
	);
export const createAlert = (
	projectId: string,
	data: Partial<Alert>,
) =>
	apiFetch<Alert>(
		`/projects/${projectId}/alerts`,
		{
			method: "POST",
			body: JSON.stringify(data),
		},
	);
export const toggleAlert = (
	id: string,
	enabled: boolean,
) =>
	apiFetch<Alert>(`/alerts/${id}`, {
		method: "PATCH",
		body: JSON.stringify({ enabled }),
	});
export const deleteAlert = (id: string) =>
	apiFetch<{ ok: boolean }>(`/alerts/${id}`, {
		method: "DELETE",
	});

// ─── GitHub OAuth ───────────────────────────────────────

export const getGithubAuthUrl = () =>
	apiFetch<{ url: string }>("/github/auth-url");

export const getGithubUser = () =>
	apiFetch<{ login: string; avatar_url: string }>("/github/user");

export const getGithubRepos = () =>
	apiFetch<GithubRepo[]>("/github/repos");

export const disconnectGithub = () =>
	apiFetch<{ ok: boolean }>("/github/disconnect", { method: "POST" });

export const getGithubIntegration = () =>
	apiFetch<GithubIntegrationStatus>("/github/integration");

export const setGithubIntegration = (data: {
	clientId: string;
	clientSecret: string;
	appName?: string;
	webhookSecret?: string;
}) =>
	apiFetch<{ ok: boolean }>("/github/integration", {
		method: "PUT",
		body: JSON.stringify(data),
	});

export const getSmtpSettings = () =>
	apiFetch<SmtpSettingsStatus>("/settings/smtp");

export const setSmtpSettings = (data: {
	host: string;
	port: number;
	user?: string;
	pass?: string;
	fromAddress?: string;
}) =>
	apiFetch<{ ok: boolean }>("/settings/smtp", {
		method: "PUT",
		body: JSON.stringify(data),
	});

export const testSmtpSettings = () =>
	apiFetch<{ ok: boolean } | { error: string }>("/settings/smtp/test", {
		method: "POST",
	});
