import type {
	Project,
	Deployment,
	CreateProjectInput,
	EnvironmentVariable,
	Volume,
	Database,
	Domain,
	ScalingPolicy,
	Server,
	ApiKey,
	Alert,
	Log,
} from "../types";
import { apiFetch, BASE, ApiError } from "./core";

export { BASE, ApiError, apiFetch };
export * from "./ai";
export * from "./settings";

export const listProjects = () =>
	apiFetch<Project[]>("/projects");
export const getProject = (id: string) =>
	apiFetch<Project>(`/projects/${id}`);
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
	apiFetch<void>(
		`/deployments/${id}/cancel`,
		{ method: "POST" },
	);
export const deleteDeployment = (id: string) =>
	apiFetch<void>(
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
	apiFetch<void>(`/env-vars/${id}`, {
		method: "DELETE",
	});
export const revealEnvVar = (id: string) =>
	apiFetch<{ value: string }>(`/env-vars/${id}/reveal`);

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
	apiFetch<void>(`/volumes/${id}`, {
		method: "DELETE",
	});

export const listAllDatabases = () =>
	apiFetch<Database[]>("/databases");
export const listDatabases = (projectId: string) =>
	apiFetch<Database[]>(
		`/projects/${projectId}/databases`,
	);
export const getDatabase = (id: string) =>
	apiFetch<Database>(`/databases/${id}`);
export const createDatabase = (data: {
	name: string;
	type: string;
	version?: string;
	projectId?: string;
	publicAccess?: boolean;
	allowPublicAccessFromAnywhere?: boolean;
	allowedCidrs?: string[];
}) =>
	apiFetch<Database>("/databases", {
		method: "POST",
		body: JSON.stringify(data),
	});
export const deleteDatabase = (id: string) =>
	apiFetch<void>(`/databases/${id}`, {
		method: "DELETE",
	});
export const getDatabaseCredentials = (id: string) =>
	apiFetch<{
		connectionString: string;
		databaseName: string;
		username: string;
		password: string;
		host: string;
		port: number;
		externalConnectionString: string | null;
		externalHost: string | null;
		externalPort: number | null;
	}>(`/databases/${id}/credentials`);
export const startDatabase = (id: string) =>
	apiFetch<Database>(`/databases/${id}/start`, { method: "POST" });
export const stopDatabase = (id: string) =>
	apiFetch<Database>(`/databases/${id}/stop`, { method: "POST" });
export const restartDatabase = (id: string) =>
	apiFetch<Database>(`/databases/${id}/restart`, { method: "POST" });
export const retryDatabase = (id: string) =>
	apiFetch<Database>(`/databases/${id}/retry`, { method: "POST" });

export const listDomains = (projectId: string) =>
	apiFetch<Domain[]>(
		`/projects/${projectId}/domains`,
	);
export const createDomain = (
	projectId: string,
	domain: string,
	type?: string,
	targetService?: string,
	targetPort?: number,
) =>
	apiFetch<Domain>(
		`/projects/${projectId}/domains`,
		{
			method: "POST",
			body: JSON.stringify({
				domain,
				type,
				targetService,
				targetPort,
			}),
		},
	);
export const getDomain = (id: string) =>
	apiFetch<Domain>(`/domains/${id}`);
export const deleteDomain = (id: string) =>
	apiFetch<void>(`/domains/${id}`, {
		method: "DELETE",
	});
export const getDomainStatus = (projectId: string) =>
	apiFetch<Array<{
		domain: string;
		dnsOk: boolean;
		tlsOk: boolean;
		lastChecked: string;
	}>>(`/projects/${projectId}/domains/status`);

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
	apiFetch<void>(
		`/projects/${projectId}/scaling`,
		{ method: "DELETE" },
	);

export const getServerIp = () =>
	apiFetch<{ ip: string; baseDomain: string; resolves: boolean; url: string }>("/server/ip");

export const login = (username: string, password: string) =>
	apiFetch<{ username: string }>("/auth/login", {
		method: "POST",
		body: JSON.stringify({ username, password }),
	});

export const logout = () =>
	apiFetch<void>("/auth/logout", { method: "POST" });

export const refreshSession = () =>
	apiFetch<{ username: string }>("/auth/refresh", { method: "POST" });

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

export const listServers = () =>
	apiFetch<Server[]>("/servers");
export const createServer = (data: {
	name: string;
	host: string;
	port?: number;
	mode?: string;
	sshUser?: string;
	sshKey?: string;
	sshPassword?: string;
	authToken?: string;
}) =>
	apiFetch<Server>("/servers", {
		method: "POST",
		body: JSON.stringify(data),
	});
export const getServer = (id: string) =>
	apiFetch<Server>(`/servers/${id}`);
export const prepareServer = (id: string) =>
	apiFetch<{ preparing: boolean }>(`/servers/${id}/prepare`, {
		method: "POST",
	});
export const serverPrepareStreamUrl = (id: string) =>
	`${BASE}/servers/${id}/prepare/stream`;
export const deleteServer = (id: string) =>
	apiFetch<void>(`/servers/${id}`, {
		method: "DELETE",
	});
export const createAgentRegistrationToken = (data: {
	name: string;
	labels?: Record<string, string>;
}) =>
	apiFetch<{ token: string; expiresAt: string }>("/agents/registration-tokens", {
		method: "POST",
		body: JSON.stringify(data),
	});

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
	apiFetch<void>(`/api-keys/${id}`, {
		method: "DELETE",
	});

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
	apiFetch<void>(`/alerts/${id}`, {
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
