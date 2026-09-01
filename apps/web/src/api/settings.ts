import { apiFetch } from "./core";
import type {
	GithubIntegrationStatus,
	SmtpSettingsStatus,
	GithubRepo,
} from "../types";

export const getGithubAuthUrl = () =>
	apiFetch<{ url: string }>("/github/auth-url");

export const getGithubUser = () =>
	apiFetch<{ login: string; avatar_url: string }>("/github/user");

export const getGithubRepos = () =>
	apiFetch<GithubRepo[]>("/github/repos");

export const disconnectGithub = () =>
	apiFetch<void>("/github/disconnect", { method: "POST" });

export const getGithubIntegration = () =>
	apiFetch<GithubIntegrationStatus>("/github/integration");

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

export const getSmtpSettings = () =>
	apiFetch<SmtpSettingsStatus>("/settings/smtp");

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

export const getRepoHooks = (owner: string, repo: string) =>
	apiFetch<Array<{ id: number; url: string; active: boolean; events: string[] }>>(`/github/repos/${owner}/${repo}/hooks`);

export const registerRepoHook = (owner: string, repo: string) =>
	apiFetch<{ id: number; created: boolean; url: string }>(`/github/repos/${owner}/${repo}/hook`, {
		method: "POST",
	});

export const removeRepoHook = (owner: string, repo: string) =>
	apiFetch<{ removed: boolean }>(`/github/repos/${owner}/${repo}/hook`, {
		method: "DELETE",
	});
