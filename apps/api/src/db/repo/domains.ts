import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { CreateDomainInput, Domain, DomainTlsMode, DomainValidationStatus, SslStatus } from "../../types";
import { config } from "../../utils/config";
import { decryptValue, encryptValue } from "../../utils/crypto";
import { getDb } from "../db-provider";
import { domains } from "../schema";
import { getRowsAffected, now } from "./helpers";

const mapDomain = (row: typeof domains.$inferSelect): Domain => ({
	id: row.id,
	projectId: row.projectId,
	domain: row.domain,
	type: row.type as Domain["type"],
	validationStatus: row.validationStatus as DomainValidationStatus,
	sslStatus: row.sslStatus as SslStatus,
	targetService: row.targetService ?? null,
	targetPort: row.targetPort ?? null,
	cloudflareProxied: Boolean(row.cloudflareProxied),
	tlsMode: (row.tlsMode ?? "auto") as DomainTlsMode,
	hasCustomCertificate: Boolean(row.certificate),
	basicAuthUser: row.basicAuthUser ?? null,
	hasBasicAuthPassword: Boolean(row.basicAuthPasswordEncrypted),
	httpsRedirect: Boolean(row.httpsRedirect),
	gzip: Boolean(row.gzip),
	noindex: Boolean(row.noindex),
	wwwRedirect: Boolean(row.wwwRedirect),
	pathPrefix: row.pathPrefix ?? null,
	stripPrefix: Boolean(row.stripPrefix),
	rawSnippet: row.rawSnippet ?? null,
	createdAt: row.createdAt.toISOString(),
	updatedAt: row.updatedAt.toISOString(),
});

export const createDomain = async (input: CreateDomainInput): Promise<Domain> => {
	const id = randomUUID();
	const timestamp = now();
	const db = await getDb();
	const keyEnc = input.certificateKey ? encryptValue(input.certificateKey, config.envEncryptionKey) : null;
	const passEnc = input.basicAuthPassword ? encryptValue(input.basicAuthPassword, config.envEncryptionKey) : null;
	await db
		.insert(domains)
		.values({
			id,
			projectId: input.projectId,
			domain: input.domain,
			type: input.type,
			validationStatus: "pending",
			sslStatus: "pending",
			targetService: input.targetService ?? null,
			targetPort: input.targetPort ?? null,
			cloudflareProxied: Boolean(input.cloudflareProxied),
			tlsMode: input.tlsMode ?? "auto",
			certificate: input.certificate ?? null,
			certificateKeyEncrypted: keyEnc?.encrypted ?? null,
			certificateKeyIv: keyEnc?.iv ?? null,
			certificateKeyTag: keyEnc?.tag ?? null,
			basicAuthUser: input.basicAuthUser ?? null,
			basicAuthPasswordEncrypted: passEnc?.encrypted ?? null,
			basicAuthPasswordIv: passEnc?.iv ?? null,
			basicAuthPasswordTag: passEnc?.tag ?? null,
			httpsRedirect: input.httpsRedirect ?? true,
			gzip: input.gzip ?? true,
			noindex: input.noindex ?? false,
			wwwRedirect: input.wwwRedirect ?? false,
			pathPrefix: input.pathPrefix ?? null,
			stripPrefix: input.stripPrefix ?? false,
			rawSnippet: input.rawSnippet ?? null,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		.execute();
	const [row] = await db.select().from(domains).where(eq(domains.id, id)).execute();
	return mapDomain(row);
};

export const listDomains = async (projectId: string): Promise<Domain[]> => {
	const db = await getDb();
	const rows = await db
		.select()
		.from(domains)
		.where(eq(domains.projectId, projectId))
		.orderBy(desc(domains.createdAt))
		.execute();
	return rows.map(mapDomain);
};

export const getDomainById = async (id: string): Promise<Domain | null> => {
	const db = await getDb();
	const [row] = await db.select().from(domains).where(eq(domains.id, id)).execute();
	return row ? mapDomain(row) : null;
};

export const updateDomainValidation = async (
	id: string,
	validationStatus: DomainValidationStatus,
	sslStatus?: SslStatus,
): Promise<void> => {
	const db = await getDb();
	const updates: Record<string, unknown> = { validationStatus, updatedAt: now() };
	if (sslStatus !== undefined) updates.sslStatus = sslStatus;
	await db.update(domains).set(updates).where(eq(domains.id, id)).execute();
};

export const updateDomainSslStatus = async (id: string, sslStatus: SslStatus): Promise<void> => {
	const db = await getDb();
	await db.update(domains).set({ sslStatus, updatedAt: now() }).where(eq(domains.id, id)).execute();
};

export const updateDomainSettings = async (id: string, patch: Partial<CreateDomainInput>): Promise<Domain | null> => {
	const updates: Record<string, unknown> = { updatedAt: now() };
	if (patch.targetService !== undefined) updates.targetService = patch.targetService;
	if (patch.targetPort !== undefined) updates.targetPort = patch.targetPort;
	if (patch.cloudflareProxied !== undefined) updates.cloudflareProxied = patch.cloudflareProxied;
	if (patch.tlsMode !== undefined) updates.tlsMode = patch.tlsMode;
	if (patch.certificate !== undefined) {
		updates.certificate = patch.certificate;
		if (patch.certificateKey !== undefined) {
			const enc = patch.certificateKey ? encryptValue(patch.certificateKey, config.envEncryptionKey) : null;
			updates.certificateKeyEncrypted = enc?.encrypted ?? null;
			updates.certificateKeyIv = enc?.iv ?? null;
			updates.certificateKeyTag = enc?.tag ?? null;
		}
	}
	if (patch.basicAuthUser !== undefined) updates.basicAuthUser = patch.basicAuthUser;
	if (patch.basicAuthPassword !== undefined) {
		const enc = patch.basicAuthPassword ? encryptValue(patch.basicAuthPassword, config.envEncryptionKey) : null;
		updates.basicAuthPasswordEncrypted = enc?.encrypted ?? null;
		updates.basicAuthPasswordIv = enc?.iv ?? null;
		updates.basicAuthPasswordTag = enc?.tag ?? null;
	}
	if (patch.httpsRedirect !== undefined) updates.httpsRedirect = patch.httpsRedirect;
	if (patch.gzip !== undefined) updates.gzip = patch.gzip;
	if (patch.noindex !== undefined) updates.noindex = patch.noindex;
	if (patch.wwwRedirect !== undefined) updates.wwwRedirect = patch.wwwRedirect;
	if (patch.pathPrefix !== undefined) updates.pathPrefix = patch.pathPrefix;
	if (patch.stripPrefix !== undefined) updates.stripPrefix = patch.stripPrefix;
	if (patch.rawSnippet !== undefined) updates.rawSnippet = patch.rawSnippet;
	const db = await getDb();
	const result = await db.update(domains).set(updates).where(eq(domains.id, id)).execute();
	if (getRowsAffected(result) === 0) return null;
	return getDomainById(id);
};

export const getDomainSecrets = async (
	id: string,
): Promise<{ certificate: string | null; certificateKey: string | null; basicAuthPassword: string | null }> => {
	const db = await getDb();
	const [row] = await db.select().from(domains).where(eq(domains.id, id)).execute();
	if (!row) return { certificate: null, certificateKey: null, basicAuthPassword: null };
	const decrypt = (encrypted: string | null, iv: string | null, tag: string | null) => {
		if (!encrypted || !iv || !tag) return null;
		try {
			return decryptValue(encrypted, iv, tag, config.envEncryptionKey);
		} catch {
			return null;
		}
	};
	return {
		certificate: row.certificate ?? null,
		certificateKey: decrypt(row.certificateKeyEncrypted, row.certificateKeyIv, row.certificateKeyTag),
		basicAuthPassword: decrypt(row.basicAuthPasswordEncrypted, row.basicAuthPasswordIv, row.basicAuthPasswordTag),
	};
};

export const deleteDomain = async (id: string): Promise<boolean> => {
	const db = await getDb();
	return getRowsAffected(await db.delete(domains).where(eq(domains.id, id)).execute()) > 0;
};
