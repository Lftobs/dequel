import { createPrivateKey } from "node:crypto";
import { Elysia } from "elysia";
import {
	computeSshKeyFingerprint,
	createSshKey,
	deleteSshKey,
	getSshKeyByFingerprint,
	getSshKeyById,
	listSshKeys,
} from "../../db/repo/ssh-keys";
import { fail, ok } from "../response";

const PRIVATE_KEY_PATTERN =
	/^-----BEGIN ((?:[A-Z0-9]+ )*?)PRIVATE KEY-----\r?\n([\s\S]*?)-----END \1PRIVATE KEY-----\s*$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const validatePrivateKey = (value: string): string | null => {
	const trimmed = value.trim();
	const match = PRIVATE_KEY_PATTERN.exec(trimmed);
	if (!match) return "privateKey must be a PEM or OpenSSH private key";
	const keyType = (match[1] ?? "").trim();
	if (keyType === "OPENSSH") {
		const body = match[2]
			.split(/\r?\n/)
			.filter((line) => !line.includes(":"))
			.join("")
			.replace(/\s/g, "");
		if (body.length < 16 || !BASE64_PATTERN.test(body)) {
			return "privateKey body is not valid base64";
		}
		return null;
	}
	try {
		createPrivateKey(trimmed);
		return null;
	} catch (err) {
		if (/passphrase/i.test((err as Error).message)) {
			return "privateKey is passphrase-protected; provide an unencrypted key";
		}
		return "privateKey could not be parsed as a valid private key";
	}
};

const isUniqueViolation = (err: unknown): boolean => {
	const e = err as { code?: string; cause?: { code?: string } };
	return e?.code === "23505" || e?.cause?.code === "23505";
};

const duplicateKey = async (fingerprint: string, set: any) => {
	const existing = await getSshKeyByFingerprint(fingerprint);
	if (!existing) return null;
	set.status = 409;
	return fail(`SSH key already exists in the pool as "${existing.name}"`);
};

export const sshKeysRoutes = new Elysia()
	.get("/ssh-keys", async () => {
		return ok(await listSshKeys());
	})
	.post("/ssh-keys", async ({ body, set }: any) => {
		if (
			typeof body?.name !== "string" ||
			!body.name.trim() ||
			typeof body.privateKey !== "string" ||
			!body.privateKey
		) {
			set.status = 400;
			return fail("name and privateKey are required");
		}
		const keyError = validatePrivateKey(body.privateKey);
		if (keyError) {
			set.status = 400;
			return fail(keyError);
		}
		const fingerprint = computeSshKeyFingerprint(body.privateKey);
		const existing = await duplicateKey(fingerprint, set);
		if (existing) return existing;
		try {
			const created = await createSshKey({
				name: body.name,
				privateKey: body.privateKey,
				tags: body.tags,
			});
			set.status = 201;
			return ok(created);
		} catch (err) {
			if (isUniqueViolation(err)) {
				const raced = await duplicateKey(fingerprint, set);
				if (raced) return raced;
			}
			throw err;
		}
	})
	.get("/ssh-keys/:id", async ({ params, set }: any) => {
		const key = await getSshKeyById(params.id);
		if (!key) {
			set.status = 404;
			return fail("Not found");
		}
		return ok(key);
	})
	.delete("/ssh-keys/:id", async ({ params, set }: any) => {
		const deleted = await deleteSshKey(params.id);
		if (!deleted) {
			set.status = 404;
			return fail("Not found");
		}
		return ok(null, "Deleted");
	});
