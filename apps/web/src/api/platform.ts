import type { AuditLog, CreateDomainInput, Domain, NotificationChannel, NotificationEvent, Registry } from "../types";
import { apiFetch } from "./http";

export const createDomainAdvanced = (projectId: string, data: CreateDomainInput) =>
	apiFetch<Domain>(`/projects/${projectId}/domains`, {
		method: "POST",
		body: JSON.stringify(data),
	});

export const updateDomain = (id: string, data: Partial<CreateDomainInput>) =>
	apiFetch<Domain>(`/domains/${id}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});

export const verifyDomain = (id: string) =>
	apiFetch<{ domain: string; validationStatus: string; serverIp: string }>(`/domains/${id}/verify`, {
		method: "POST",
	});

export const regenerateDeployWebhookToken = (projectId: string) =>
	apiFetch<{ token: string }>(`/projects/${projectId}/webhook-token`, { method: "POST" });

export const deployProjectsByTag = (tag: string, branch?: string) =>
	apiFetch<{ deployments: Array<{ id: string }>; failures: Array<{ projectId: string; error: string }> }>(
		`/projects/by-tag/${encodeURIComponent(tag)}/deploy`,
		{ method: "POST", body: JSON.stringify({ branch }) },
	);

export const listRegistries = () => apiFetch<Registry[]>("/registries");

export const createRegistry = (data: {
	name: string;
	url: string;
	username: string;
	password: string;
	serverId?: string | null;
}) =>
	apiFetch<Registry>("/registries", {
		method: "POST",
		body: JSON.stringify(data),
	});

export const updateRegistry = (
	id: string,
	data: Partial<{ name: string; url: string; username: string; password: string; serverId: string | null }>,
) =>
	apiFetch<Registry>(`/registries/${id}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});

export const deleteRegistry = (id: string) => apiFetch<void>(`/registries/${id}`, { method: "DELETE" });

export const listNotificationChannels = () => apiFetch<NotificationChannel[]>("/notifications");

export const createNotificationChannel = (data: {
	name: string;
	channel: string;
	destination?: string | null;
	events?: NotificationEvent[];
	enabled?: boolean;
}) =>
	apiFetch<NotificationChannel>("/notifications", {
		method: "POST",
		body: JSON.stringify(data),
	});

export const updateNotificationChannel = (
	id: string,
	data: Partial<{
		name: string;
		channel: string;
		destination: string | null;
		events: NotificationEvent[];
		enabled: boolean;
	}>,
) =>
	apiFetch<NotificationChannel>(`/notifications/${id}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});

export const deleteNotificationChannel = (id: string) => apiFetch<void>(`/notifications/${id}`, { method: "DELETE" });

export const testNotificationChannel = (data: { channel: string; destination?: string | null }) =>
	apiFetch<Array<{ channel: string; status: "sent" | "failed"; error?: string }>>("/notifications/test", {
		method: "POST",
		body: JSON.stringify(data),
	});

export const listAuditLogs = (
	params: {
		limit?: number;
		offset?: number;
		actorType?: string;
		actorId?: string;
		action?: string;
		resourceType?: string;
		resourceId?: string;
	} = {},
) => {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== "") query.set(key, String(value));
	}
	const qs = query.toString();
	return apiFetch<{ items: AuditLog[]; total: number; limit: number; offset: number }>(
		`/audit-logs${qs ? `?${qs}` : ""}`,
	);
};

export const pauseApiKey = (id: string, paused: boolean) =>
	apiFetch<{ id: string; pausedAt: string | null }>(`/api-keys/${id}`, {
		method: "PATCH",
		body: JSON.stringify({ paused }),
	});

export const rollApiKey = (id: string) =>
	apiFetch<{ id: string; rawKey: string }>(`/api-keys/${id}/roll`, { method: "POST" });
