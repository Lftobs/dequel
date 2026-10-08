import { describe, expect, it } from "bun:test";
import { Readable } from "node:stream";
import { createBackupDecryptStream, createBackupEncryptStream } from "../crypto";

describe("Backup Crypto Streams", () => {
	it("encrypts and decrypts stream data round-trip", async () => {
		const plainText = "CREATE TABLE users (id serial primary key, email text);";
		const source = Readable.from([Buffer.from(plainText, "utf-8")]);

		const { input: encInput, output: encOutput } = createBackupEncryptStream();
		source.pipe(encInput);

		const chunks: Buffer[] = [];
		for await (const chunk of encOutput) {
			chunks.push(chunk as Buffer);
		}
		const encryptedBytes = Buffer.concat(chunks);

		expect(encryptedBytes.toString("utf-8")).not.toContain(plainText);
		expect(encryptedBytes.length).toBeGreaterThan(16);

		const encSource = Readable.from([encryptedBytes]);
		const { input: decInput, output: decOutput } = createBackupDecryptStream();
		encSource.pipe(decInput);

		const decryptedChunks: Buffer[] = [];
		for await (const chunk of decOutput) {
			decryptedChunks.push(chunk as Buffer);
		}
		const decryptedText = Buffer.concat(decryptedChunks).toString("utf-8");

		expect(decryptedText).toBe(plainText);
	});
});
