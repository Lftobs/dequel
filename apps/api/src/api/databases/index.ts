import { isIP } from "node:net";
import { Elysia } from "elysia";
import { validateDatabaseCreate } from "../../databases/validation";
import {
	createDatabase as createDbRecord,
	deleteDatabase,
	getDatabaseById,
	getProjectById,
	listAllDatabases,
	listDatabases,
	updateDatabaseStatus,
} from "../../db/repo";
import type { Database } from "../../types";
import { resolveServerIp } from "../../utils/dns";
import { created, fail, ok } from "../response";

const sanitizeDatabase = <T extends { password: string; connectionString: string }>(database: T) => ({
	...database,
	password: "",
	connectionString: "",
});

type DatabaseRecord = NonNullable<Awaited<ReturnType<typeof getDatabaseById>>>;

const dbOperationLock = new Map<string, Promise<void>>();

const withDatabaseLock = <T>(id: string, operation: () => Promise<T>): Promise<T> => {
	const previous = dbOperationLock.get(id) ?? Promise.resolve();
	let tail!: Promise<void>;
	const result = previous.then(async () => {
		try {
			return await operation();
		} finally {
			if (dbOperationLock.get(id) === tail) dbOperationLock.delete(id);
		}
	});
	tail = result.then(
		() => undefined,
		() => undefined,
	);
	dbOperationLock.set(id, tail);
	return result;
};

const BUSY_STATUSES = new Set<Database["status"]>(["provisioning", "restarting", "deleting", "deletion_failed"]);

const busyError = (dbRecord: DatabaseRecord, set: any) => {
	if (BUSY_STATUSES.has(dbRecord.status)) {
		set.status = 409;
		return fail(`Database is ${dbRecord.status}; wait for the current operation to finish`);
	}
	return null;
};

const isNonLoopbackIp = (value: string): boolean => {
	if (isIP(value) !== 4) return false;
	return !value.startsWith("127.");
};

const createManagedDatabase = async (body: any, projectId: string | null, set: any) => {
	if (projectId && !(await getProjectById(projectId))) {
		set.status = 404;
		return fail("Project not found");
	}
	const validation = validateDatabaseCreate(body ?? {});
	if (!validation.ok) {
		set.status = 400;
		return fail(validation.error);
	}
	const existing = await listAllDatabases();
	if (existing.some((database) => database.name.toLowerCase() === validation.input.name.toLowerCase())) {
		set.status = 409;
		return fail("A database with this name already exists");
	}
	const dbRecord = await createDbRecord({ ...validation.input, projectId });
	const { provisionDatabase } = await import("../../databases/manager");
	provisionDatabase(dbRecord).catch((err: Error) => console.error("DB provision failed", err));
	return created(sanitizeDatabase(dbRecord));
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
	.get("/databases", async () => ok((await listAllDatabases()).map(sanitizeDatabase)))
	.post("/databases", async ({ body, set }: any) => createManagedDatabase(body, body?.projectId || null, set))
	.get("/projects/:id/databases", async ({ params }) => ok((await listDatabases(params.id)).map(sanitizeDatabase)))
	.post("/projects/:id/databases", async ({ params, body, set }: any) => createManagedDatabase(body, params.id, set))
	.get("/databases/:id", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return fail("Database not found");
		const { measureDatabaseStorage } = await import("../../databases/manager");
		const staleStorage = Date.now() - new Date(dbRecord.updatedAt).getTime() > 5 * 60_000;
		if (dbRecord.status !== "provisioning" && staleStorage) {
			await measureDatabaseStorage(dbRecord).catch(() => dbRecord.storageUsedMb);
		}
		return ok(sanitizeDatabase((await getDatabaseById(id))!));
	})
	.get("/databases/:id/credentials", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return fail("Database not found");
		const externalHost = dbRecord.publicAccess && dbRecord.externalPort ? await resolveServerIp() : null;
		const usableHost = externalHost && isNonLoopbackIp(externalHost) ? externalHost : null;
		const externalConnectionString = usableHost
			? buildConnectionString(dbRecord, usableHost, dbRecord.externalPort!)
			: null;
		return ok({
			username: dbRecord.username,
			password: dbRecord.password,
			internalConnectionString: dbRecord.connectionString,
			externalConnectionString,
			externalHost: usableHost,
			externalPort: usableHost ? dbRecord.externalPort : null,
		});
	})
	.post("/databases/:id/start", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return fail("Database not found");
		return withDatabaseLock(id, async () => {
			const latest = (await getDatabaseById(id))!;
			const blocked = busyError(latest, set);
			if (blocked) return blocked;
			const { startDatabase } = await import("../../databases/manager");
			await startDatabase(latest);
			return ok(sanitizeDatabase((await getDatabaseById(id))!));
		});
	})
	.post("/databases/:id/stop", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return fail("Database not found");
		return withDatabaseLock(id, async () => {
			const latest = (await getDatabaseById(id))!;
			const blocked = busyError(latest, set);
			if (blocked) return blocked;
			const { stopDatabase } = await import("../../databases/manager");
			await stopDatabase(latest);
			return ok(sanitizeDatabase((await getDatabaseById(id))!));
		});
	})
	.post("/databases/:id/restart", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return fail("Database not found");
		return withDatabaseLock(id, async () => {
			const latest = (await getDatabaseById(id))!;
			const blocked = busyError(latest, set);
			if (blocked) return blocked;
			const { restartDatabase } = await import("../../databases/manager");
			await restartDatabase(latest);
			return ok(sanitizeDatabase((await getDatabaseById(id))!));
		});
	})
	.post("/databases/:id/retry", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return fail("Database not found");
		return withDatabaseLock(id, async () => {
			const latest = (await getDatabaseById(id))!;
			if (latest.status !== "failed") {
				set.status = 409;
				return fail("Only failed databases can be retried");
			}
			await updateDatabaseStatus(id, "provisioning");
			const { provisionDatabase } = await import("../../databases/manager");
			provisionDatabase((await getDatabaseById(id))!).catch((err: Error) =>
				console.error("DB reprovision failed", err),
			);
			return ok(sanitizeDatabase((await getDatabaseById(id))!));
		});
	})
	.delete("/databases/:id", async ({ params: { id }, set }) => {
		const dbRecord = await findDatabase(id, set);
		if (!dbRecord) return fail("Database not found");
		return withDatabaseLock(id, async () => {
			const latest = (await getDatabaseById(id))!;
			if (latest.status === "deleting") {
				set.status = 409;
				return fail("Database is already being deleted");
			}
			const { deprovisionDatabase, waitForProvision } = await import("../../databases/manager");
			await waitForProvision(id);
			await updateDatabaseStatus(id, "deleting");
			const current = (await getDatabaseById(id)) ?? latest;
			try {
				await deprovisionDatabase(current);
			} catch (error) {
				console.error(`Failed to deprovision database ${id}:`, error);
				await updateDatabaseStatus(id, "deletion_failed");
				set.status = 502;
				return fail("Database resources could not be deleted; cleanup will be retried automatically");
			}
			await deleteDatabase(id);
			return ok(null, "Database deleted");
		});
	});

const buildConnectionString = (dbRecord: DatabaseRecord, host: string, port: number) => {
	if (dbRecord.type === "redis") return `redis://:${dbRecord.password}@${host}:${port}`;
	if (dbRecord.type === "mongodb") {
		return `mongodb://${dbRecord.username}:${dbRecord.password}@${host}:${port}/${dbRecord.databaseName}?authSource=admin`;
	}
	const protocol = dbRecord.type === "mysql" ? "mysql" : "postgresql";
	return `${protocol}://${dbRecord.username}:${dbRecord.password}@${host}:${port}/${dbRecord.databaseName}`;
};
