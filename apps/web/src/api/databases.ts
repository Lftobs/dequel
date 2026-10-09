import type { BackupJob, BackupStorageSettingsData, Database, QueryExecResult, TableInfo } from "../types";
import { apiFetch } from "./http";

export const listAllDatabases = () => apiFetch<Database[]>("/databases");
export const listDatabases = (projectId: string) => apiFetch<Database[]>(`/projects/${projectId}/databases`);
export const createDatabase = (
	projectId: string | null,
	type: string,
	options?: {
		name?: string;
		version?: string;
		serverId?: string;
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
		externalReachable: boolean | null;
		warning: string | null;
	}>(`/databases/${id}/credentials`);
export const startDatabase = (id: string) => apiFetch<Database>(`/databases/${id}/start`, { method: "POST" });
export const stopDatabase = (id: string) => apiFetch<Database>(`/databases/${id}/stop`, { method: "POST" });
export const restartDatabase = (id: string) => apiFetch<Database>(`/databases/${id}/restart`, { method: "POST" });
export const retryDatabase = (id: string) => apiFetch<Database>(`/databases/${id}/retry`, { method: "POST" });
export const updateDatabaseSettings = (
	id: string,
	data: {
		name?: string;
		cpuLimit?: number | null;
		memoryLimitMb?: number | null;
		storageLimitMb?: number | null;
		publicAccess?: boolean;
		allowPublicAccessFromAnywhere?: boolean;
		allowedCidrs?: string[];
		backupEnabled?: boolean;
		backupSchedule?: string;
		backupRetention?: number;
	},
) =>
	apiFetch<Database>(`/databases/${id}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});
export const getDatabaseTables = (id: string) => apiFetch<TableInfo[]>(`/databases/${id}/tables`);
export const queryDatabase = (id: string, query: string) =>
	apiFetch<QueryExecResult>(`/databases/${id}/query`, {
		method: "POST",
		body: JSON.stringify({ query }),
	});

export const listBackups = () => apiFetch<BackupJob[]>("/backups");
export const triggerBackup = (targetId = "internal") =>
	apiFetch<BackupJob>(targetId === "internal" ? "/backups" : `/backups/${targetId}/trigger`, {
		method: "POST",
	});
export const restoreBackup = (id: string) =>
	apiFetch<{ restored: boolean }>(`/backups/${id}/restore`, { method: "POST" });
export const deleteBackup = (id: string) => apiFetch<{ deleted: boolean }>(`/backups/${id}`, { method: "DELETE" });
export const getBackupStorageSettings = () => apiFetch<BackupStorageSettingsData>("/settings/backup");
export const updateBackupStorageSettings = (data: BackupStorageSettingsData) =>
	apiFetch<BackupStorageSettingsData>("/settings/backup", {
		method: "PUT",
		body: JSON.stringify(data),
	});
