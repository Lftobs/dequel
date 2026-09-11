import type { BackupStorage } from "../storage";
import type { StorageConfig } from "../types";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";

export function createStorage(config: StorageConfig): BackupStorage {
	switch (config.type) {
		case "local":
			return new LocalStorage(config.path);
		case "s3":
			return new S3Storage(config);
	}
}
