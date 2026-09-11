import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { CreateDomainInput, Domain, DomainValidationStatus, SslStatus } from "../../types";
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
	createdAt: row.createdAt,
	updatedAt: row.updatedAt,
});

export const createDomain = async (input: CreateDomainInput): Promise<Domain> => {
	const id = randomUUID();
	const timestamp = now();
	const db = await getDb();
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

export const deleteDomain = async (id: string): Promise<boolean> => {
	const db = await getDb();
	return getRowsAffected(await db.delete(domains).where(eq(domains.id, id)).execute()) > 0;
};
