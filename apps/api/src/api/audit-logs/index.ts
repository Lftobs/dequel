import { Elysia } from "elysia";
import { countAuditLogs, listAuditLogs } from "../../db/repo";
import { ok } from "../response";

export const auditLogsRoutes = new Elysia().get("/audit-logs", async ({ query }: any) => {
	const rawLimit = Number(query?.limit);
	const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 50;
	const rawOffset = Number(query?.offset);
	const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
	const filters = {
		actorType: query?.actorType,
		actorId: query?.actorId,
		action: query?.action,
		resourceType: query?.resourceType,
		resourceId: query?.resourceId,
		limit,
		offset,
	};
	const [items, total] = await Promise.all([listAuditLogs(filters), countAuditLogs(filters)]);
	return ok({ items, total, limit, offset });
});
