import { Elysia } from "elysia";
import {
	createDatabase as createDbRecord,
	deleteDatabase,
	getDatabaseById,
	getProjectById,
	listAllDatabases,
	listDatabases,
	updateDatabaseStatus,
} from "../../db/repo";
import { resolveServerIp } from "../../utils/dns";
import { validateDatabaseCreate } from "../../databases/validation";

const sanitizeDatabase = <T extends { password: string; connectionString: string }>(database: T) => ({
	...database,
	password: "",
	connectionString: "",
});

const createManagedDatabase = async (body: any, projectId: string | null, set: any) => {
	if (projectId && !(await getProjectById(projectId))) {
		set.status = 404;
		return { error: "Project not found" };
	}
	const validation = validateDatabaseCreate(body ?? {});
	if (!validation.ok) {
		set.status = 400;
		return { error: validation.error };
	}
	const existing = await listAllDatabases();
	if (existing.some((database) => database.name.toLowerCase() === validation.input.name.toLowerCase())) {
		set.status = 409;
		return { error: "A database with this name already exists" };
	}
	const dbRecord = await createDbRecord({ ...validation.input, projectId });
	const { provisionDatabase } = await import("../../databases/manager");
	provisionDatabase(dbRecord).catch((err: Error) =>
		console.error("DB provision failed", err),
	);
	return sanitizeDatabase(dbRecord);
};

const findDatabase = async (id: string, set: any) => {
	const dbRecord = await getDatabaseById(id);
	if (!dbRecord) {
		set.status = 404;
		return null;
	}
	return dbRecord;
};

export const databasesRoutes = new Elysia()
	.get("/databases", async () => (await listAllDatabases()).map(sanitizeDatabase))
	.post("/databases", async ({ body, set }: any) =>
		createManagedDatabase(body, body?.projectId || null, set),
	)
	.get("/projects/:id/databases", async ({ params }) => (await listDatabases(params.id)).map(sanitizeDatabase))
	.post("/projects/:id/databases", async ({ params, body, set }: any) =>
		createManagedDatabase(body, params.id, set),
	)
	.get("/databases/:id", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return { error: "Database not found" };
		const { measureDatabaseStorage } = await import("../../databases/manager");
		const staleStorage = Date.now() - new Date(dbRecord.updatedAt).getTime() > 5 * 60_000;
		if (dbRecord.status !== "provisioning" && staleStorage) {
			await measureDatabaseStorage(dbRecord).catch(() => dbRecord.storageUsedMb);
		}
		return sanitizeDatabase((await getDatabaseById(id))!);
	})
	.get("/databases/:id/credentials", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return { error: "Database not found" };
		const externalHost = dbRecord.publicAccess && dbRecord.externalPort
			? await resolveServerIp()
			: null;
		const externalConnectionString = externalHost
			? buildConnectionString(dbRecord, externalHost, dbRecord.externalPort!)
			: null;
		return {
			username: dbRecord.username,
			password: dbRecord.password,
			internalConnectionString: dbRecord.connectionString,
			externalConnectionString,
			externalHost,
			externalPort: dbRecord.externalPort,
		};
	})
	.post("/databases/:id/start", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return { error: "Database not found" };
		const { startDatabase } = await import("../../databases/manager");
		await startDatabase(dbRecord);
		return sanitizeDatabase((await getDatabaseById(id))!);
	})
	.post("/databases/:id/stop", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return { error: "Database not found" };
		const { stopDatabase } = await import("../../databases/manager");
		await stopDatabase(dbRecord);
		return sanitizeDatabase((await getDatabaseById(id))!);
	})
	.post("/databases/:id/restart", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return { error: "Database not found" };
		const { restartDatabase } = await import("../../databases/manager");
		await restartDatabase(dbRecord);
		return sanitizeDatabase((await getDatabaseById(id))!);
	})
	.post("/databases/:id/retry", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return { error: "Database not found" };
		if (dbRecord.status !== "failed") {
			set.status = 409;
			return { error: "Only failed databases can be retried" };
		}
		await updateDatabaseStatus(id, "provisioning");
		const { provisionDatabase } = await import("../../databases/manager");
		provisionDatabase((await getDatabaseById(id))!).catch((err: Error) =>
			console.error("DB reprovision failed", err),
		);
		return sanitizeDatabase((await getDatabaseById(id))!);
	})
	.delete("/databases/:id", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return { error: "Database not found" };
		const { deprovisionDatabase, waitForProvision } = await import("../../databases/manager");
		await waitForProvision(id);
		await updateDatabaseStatus(id, "deleting");
		const latest = (await getDatabaseById(id)) ?? dbRecord;
		try {
			await deprovisionDatabase(latest);
		} catch (error) {
			console.error(`Failed to deprovision database ${id}:`, error);
			await updateDatabaseStatus(id, "deletion_failed");
			set.status = 502;
			return { error: "Database resources could not be deleted; cleanup will be retried automatically" };
		}
		return { ok: await deleteDatabase(id) };
	});

const buildConnectionString = (
	dbRecord: NonNullable<Awaited<ReturnType<typeof getDatabaseById>>>,
	host: string,
	port: number,
) => {
	if (dbRecord.type === "redis") return `redis://:${dbRecord.password}@${host}:${port}`;
	if (dbRecord.type === "mongodb") {
		return `mongodb://${dbRecord.username}:${dbRecord.password}@${host}:${port}/${dbRecord.databaseName}?authSource=admin`;
	}
	const protocol = dbRecord.type === "mysql" ? "mysql" : "postgresql";
	return `${protocol}://${dbRecord.username}:${dbRecord.password}@${host}:${port}/${dbRecord.databaseName}`;
};
