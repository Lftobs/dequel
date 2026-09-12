export type DatabaseType = "postgresql" | "mysql" | "redis" | "mongodb";

export interface BackupTarget {
	id: string;
	type: "internal" | "managed";
	engine: DatabaseType;
	containerName: string;
	databaseName: string;
	serverId: string | null;
	credentials: {
		username: string;
		password: string;
	};
}

export type BackupStatus = "pending" | "dumping" | "compressing" | "uploading" | "completed" | "failed";

export interface BackupJob {
	id: string;
	targetId: string;
	targetType: "internal" | "managed";
	engine: DatabaseType;
	filename: string | null;
	storageType: "local" | "s3";
	storagePath: string | null;
	sizeBytes: number | null;
	status: BackupStatus;
	error: string | null;
	createdAt: Date;
	completedAt: Date | null;
}

export interface BackupConfig {
	enabled: boolean;
	scheduleCron: string;
	retentionCount: number;
	storage: StorageConfig;
}

export type StorageConfig = LocalStorageConfig | S3StorageConfig;

export interface LocalStorageConfig {
	type: "local";
	path: string;
}

export interface S3StorageConfig {
	type: "s3";
	endpoint: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	region: string;
}
