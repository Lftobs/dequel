import type { Readable } from "node:stream";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import type { BackupStorage } from "../storage";
import type { S3StorageConfig } from "../types";

export class S3Storage implements BackupStorage {
	readonly type = "s3" as const;
	private client: S3Client;
	private bucket: string;

	constructor(config: S3StorageConfig) {
		this.client = new S3Client({
			endpoint: config.endpoint,
			region: config.region,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
		});
		this.bucket = config.bucket;
	}

	async upload(key: string, data: Readable): Promise<string> {
		const chunks: Buffer[] = [];
		for await (const chunk of data) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}
		const body = Buffer.concat(chunks);

		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: body,
			}),
		);

		return key;
	}

	async download(key: string): Promise<Readable> {
		const response = await this.client.send(
			new GetObjectCommand({
				Bucket: this.bucket,
				Key: key,
			}),
		);

		return response.Body as Readable;
	}

	async list(): Promise<{ key: string; size: number; lastModified: Date }[]> {
		const response = await this.client.send(
			new ListObjectsV2Command({
				Bucket: this.bucket,
			}),
		);

		return (response.Contents || []).map((item) => ({
			key: item.Key!,
			size: item.Size || 0,
			lastModified: item.LastModified || new Date(),
		}));
	}

	async delete(key: string): Promise<void> {
		await this.client.send(
			new DeleteObjectCommand({
				Bucket: this.bucket,
				Key: key,
			}),
		);
	}
}
