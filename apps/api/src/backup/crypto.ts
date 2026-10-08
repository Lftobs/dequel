import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Transform } from "node:stream";
import { config } from "../utils/config";
import { deriveKey } from "../utils/crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

const getEncryptionKey = (): string => {
	const key = config.envEncryptionKey;
	if (!key || (process.env.NODE_ENV === "production" && key === "dev-env-key-change-me")) {
		throw new Error("ENV_ENCRYPTION_KEY must be configured in production");
	}
	return key;
};

export const createBackupEncryptStream = () => {
	const key = deriveKey(getEncryptionKey());
	const iv = randomBytes(IV_LEN);
	const cipher = createCipheriv(ALGO, key, iv);
	let ivSent = false;

	const transform = new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			try {
				if (!ivSent) {
					this.push(iv);
					ivSent = true;
				}
				const data = cipher.update(chunk);
				if (data.length > 0) this.push(data);
				callback();
			} catch (err) {
				callback(err as Error);
			}
		},
		flush(callback) {
			try {
				if (!ivSent) {
					this.push(iv);
					ivSent = true;
				}
				const finalData = cipher.final();
				if (finalData.length > 0) this.push(finalData);
				const tag = cipher.getAuthTag();
				this.push(tag);
				callback();
			} catch (err) {
				callback(err as Error);
			}
		},
	});

	return { input: transform, output: transform };
};

export const createBackupDecryptStream = () => {
	const key = deriveKey(getEncryptionKey());
	let buffer = Buffer.alloc(0);
	let decipher: ReturnType<typeof createDecipheriv> | null = null;

	const transform = new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			try {
				buffer = Buffer.concat([buffer, chunk]);
				if (!decipher) {
					if (buffer.length < IV_LEN + TAG_LEN) {
						return callback();
					}
					const iv = buffer.subarray(0, IV_LEN);
					decipher = createDecipheriv(ALGO, key, iv);
					buffer = buffer.subarray(IV_LEN);
				}
				if (buffer.length > TAG_LEN) {
					const cipherText = buffer.subarray(0, buffer.length - TAG_LEN);
					buffer = buffer.subarray(buffer.length - TAG_LEN);
					const plain = decipher.update(cipherText);
					if (plain.length > 0) this.push(plain);
				}
				callback();
			} catch (err) {
				callback(err as Error);
			}
		},
		flush(callback) {
			try {
				if (!decipher || buffer.length !== TAG_LEN) {
					return callback(new Error("Invalid backup payload: missing or truncated authentication tag"));
				}
				decipher.setAuthTag(buffer);
				const finalPlain = decipher.final();
				if (finalPlain.length > 0) this.push(finalPlain);
				callback();
			} catch (err) {
				callback(err as Error);
			}
		},
	});

	return { input: transform, output: transform };
};
