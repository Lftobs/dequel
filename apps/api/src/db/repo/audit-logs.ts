import { randomUUID } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import type { AuditLog, CreateAuditLogInput, ListAuditLogsFilters } from "../../types";
import { getDb } from "../db-provider";
import { auditLogs } from "../schema";

const mapAuditLog = (row: typeof auditLogs.$inferSelect): AuditLog => ({
	id: row.id,
	actorType: row.actorType as AuditLog["actorType"],
	actorId: row.actorId,
	action: row.action,
	resourceType: row.resourceType,
	resourceId: row.resourceId,
	details: (row.details as Record<string, unknown>) ?? {},
	ipAddress: row.ipAddress,
	userAgent: row.userAgent,
	createdAt: row.createdAt.toISOString(),
});

export const createAuditLog = async (input: CreateAuditLogInput): Promise<AuditLog> => {
	const db = await getDb();
	const id = randomUUID();
	const [row] = await db
		.insert(auditLogs)
		.values({
			id,
			actorType: input.actorType,
			actorId: input.actorId,
			action: input.action,
			resourceType: input.resourceType,
			resourceId: input.resourceId ?? null,
			details: input.details ?? {},
			ipAddress: input.ipAddress ?? null,
			userAgent: input.userAgent ?? null,
		})
		.returning();

	return mapAuditLog(row);
};

export const listAuditLogs = async (filters: ListAuditLogsFilters = {}): Promise<AuditLog[]> => {
	const db = await getDb();
	const conditions = [];

	if (filters.actorType) conditions.push(eq(auditLogs.actorType, filters.actorType));
	if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
	if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
	if (filters.resourceType) conditions.push(eq(auditLogs.resourceType, filters.resourceType));
	if (filters.resourceId) conditions.push(eq(auditLogs.resourceId, filters.resourceId));

	const query = db
		.select()
		.from(auditLogs)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(auditLogs.createdAt))
		.limit(filters.limit ?? 50)
		.offset(filters.offset ?? 0);

	const rows = await query.execute();
	return rows.map(mapAuditLog);
};

export const countAuditLogs = async (filters: ListAuditLogsFilters = {}): Promise<number> => {
	const db = await getDb();
	const conditions = [];

	if (filters.actorType) conditions.push(eq(auditLogs.actorType, filters.actorType));
	if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
	if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
	if (filters.resourceType) conditions.push(eq(auditLogs.resourceType, filters.resourceType));
	if (filters.resourceId) conditions.push(eq(auditLogs.resourceId, filters.resourceId));

	const [res] = await db
		.select({ count: count() })
		.from(auditLogs)
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	return Number(res?.count ?? 0);
};
