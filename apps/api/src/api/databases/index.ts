import { Elysia } from "elysia";
import {
	createDatabase as createDbRecord,
	deleteDatabase,
	getDatabaseById,
	listDatabases,
} from "../../db/repo";

export const databasesRoutes = new Elysia()
	.get(
		"/projects/:id/databases",
		async ({ params }) => listDatabases(params.id),
	)
	.post(
		"/projects/:id/databases",
		async ({ params, body, set }: any) => {
			if (!body?.type || !["postgresql", "mysql"].includes(body.type)) {
				set.status = 400;
				return { error: "type must be postgresql or mysql" };
			}
			const dbRecord = await createDbRecord({
				projectId: params.id,
				type: body.type,
				version: body.version,
				cpuLimit: body.cpuLimit,
				memoryLimitMb: body.memoryLimitMb,
			});
			const { provisionDatabase } = await import(
				"../../databases/manager",
			);
			provisionDatabase(dbRecord).catch((err: Error) =>
				console.error("DB provision failed", err),
			);
			return dbRecord;
		},
	)
	.get(
		"/databases/:id",
		async ({ params: { id }, set }) => {
			const dbRecord = await getDatabaseById(id);
			if (!dbRecord) {
				set.status = 404;
				return { error: "Database not found" };
			}
			return dbRecord;
		},
	)
	.delete(
		"/databases/:id",
		async ({ params: { id }, set }) => {
			const dbRecord = await getDatabaseById(id);
			if (!dbRecord) {
				set.status = 404;
				return { error: "Database not found" };
			}
			const { deprovisionDatabase } = await import(
				"../../databases/manager",
			);
			await deprovisionDatabase(dbRecord).catch(() => {});
			const ok = await deleteDatabase(id);
			return { ok };
		},
	);
