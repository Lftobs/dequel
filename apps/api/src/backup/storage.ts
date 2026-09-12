import type { Readable } from "node:stream";

export interface BackupStorage {
	upload(key: string, data: Readable): Promise<string>;

	download(key: string): Promise<Readable>;

	list(): Promise<{ key: string; size: number; lastModified: Date }[]>;

	delete(key: string): Promise<void>;
}
