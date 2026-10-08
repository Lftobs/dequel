import { Elysia } from "elysia";
import { countAuditLogs, listAuditLogs } from "../../db/repo";
import { ok } from "../response";

export const auditLogsRoutes = new Elysia().get("/audit-logs", async ({ query }: any) => {
	const filters = {
		actorType: query?.actorType,
		actorId: query?.actorId,
		action: query?.action,
		resourceType: query?.resourceType,
		resourceId: query?.resourceId,
		limit: query?.limit ? Number(query.limit) : 50,
		offset: query?.offset ? Number(query.offset) : 0,
	};
	const [items, total] = await Promise.all([listAuditLogs(filters), countAuditLogs(filters)]);
	return ok({ items, total, limit: filters.limit, offset: filters.offset });
});
