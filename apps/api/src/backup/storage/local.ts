import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { BackupStorage } from "../storage";

export class LocalStorage implements BackupStorage {
	readonly type = "local" as const;
	private basePath: string;

	constructor(basePath: string) {
		this.basePath = basePath;
	}

	async upload(key: string, data: Readable): Promise<string> {
		await mkdir(this.basePath, { recursive: true });
		const filePath = join(this.basePath, key);
		const writeStream = createWriteStream(filePath);
		await pipeline(data, writeStream);
		return filePath;
	}

	async download(key: string): Promise<Readable> {
		const filePath = join(this.basePath, key);
		return createReadStream(filePath);
	}

	async list(): Promise<{ key: string; size: number; lastModified: Date }[]> {
		try {
			const files = await readdir(this.basePath);
			const results: { key: string; size: number; lastModified: Date }[] = [];

			for (const file of files) {
				const info = await stat(join(this.basePath, file));
				if (info.isFile()) {
					results.push({
						key: file,
						size: info.size,
						lastModified: info.mtime,
					});
				}
			}

			return results;
		} catch {
			return [];
		}
	}

	async delete(key: string): Promise<void> {
		const filePath = join(this.basePath, key);
		await unlink(filePath);
	}
}
