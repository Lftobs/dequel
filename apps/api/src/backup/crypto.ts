import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { PassThrough, Transform } from "node:stream";
import { config } from "../utils/config";
import { deriveKey } from "../utils/crypto";

const ALGO = "aes-256-cbc";
const IV_LEN = 16;

export const createBackupEncryptStream = () => {
	const iv = randomBytes(IV_LEN);
	const key = deriveKey(config.envEncryptionKey || "dev-env-key-change-me");
	const cipher = createCipheriv(ALGO, key, iv);
	const output = new PassThrough();

	output.write(iv);
	cipher.pipe(output);

	return { input: cipher, output };
};

export const createBackupDecryptStream = () => {
	let ivBuffer = Buffer.alloc(0);
	let decipher: ReturnType<typeof createDecipheriv> | null = null;
	const output = new PassThrough();

	const transform = new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			if (!decipher) {
				ivBuffer = Buffer.concat([ivBuffer, chunk]);
				if (ivBuffer.length >= IV_LEN) {
					const iv = ivBuffer.subarray(0, IV_LEN);
					const remaining = ivBuffer.subarray(IV_LEN);
					const key = deriveKey(config.envEncryptionKey || "dev-env-key-change-me");
					decipher = createDecipheriv(ALGO, key, iv);
					decipher.pipe(output);
					if (remaining.length > 0) {
						decipher.write(remaining);
					}
				}
			} else {
				decipher.write(chunk);
			}
			callback();
		},
		flush(callback) {
			if (decipher) {
				decipher.end();
			}
			callback();
		},
	});

	return { input: transform, output };
};
