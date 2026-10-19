export type DatabaseType = "postgresql" | "mysql" | "redis" | "mongodb";
export type DatabaseStatus =
	| "provisioning"
	| "running"
	| "stopped"
	| "restarting"
	| "deleting"
	| "deletion_failed"
	| "failed";

export interface Database {
	id: string;
	projectId: string | null;
	serverId: string | null;
	name: string;
	type: DatabaseType;
	version: string | null;
	databaseName: string;
	username: string;
	password: string;
	internalHost: string;
	internalPort: number;
	cpuLimit: number | null;
	memoryLimitMb: number | null;
	storageLimitMb: number | null;
	storageUsedMb: number;
	publicAccess: boolean;
	allowPublicAccessFromAnywhere: boolean;
	allowedCidrs: string[];
	externalPort: number | null;
	proxyContainerName: string | null;
	volumeName: string;
	connectionString: string;
	status: DatabaseStatus;
	containerName: string | null;
	backupEnabled: boolean;
	backupSchedule: string;
	backupRetention: number;
	createdAt: string;
	updatedAt: string;
}

export interface CreateDatabaseInput {
	projectId?: string | null;
	serverId?: string | null;
	name: string;
	type: DatabaseType;
	version?: string;
	cpuLimit?: number | null;
	memoryLimitMb?: number | null;
	storageLimitMb?: number | null;
	publicAccess?: boolean;
	allowPublicAccessFromAnywhere?: boolean;
	allowedCidrs?: string[];
	backupEnabled?: boolean;
	backupSchedule?: string;
	backupRetention?: number;
}

export interface BackupStorageSettingsData {
	type: "local" | "s3";
	path?: string;
	s3Endpoint?: string;
	s3AccessKeyId?: string;
	s3SecretAccessKey?: string;
	s3Bucket?: string;
	s3Region?: string;
	systemBackupSchedule?: string;
	systemBackupRetention?: number;
}
