import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { setDbProvider } from "../db-provider";
import * as schema from "../schema";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://dequel:dequel@localhost:5433/dequel";
const TABLE_NAMES = [
	"agent_credentials",
	"agent_jobs",
	"agent_registration_tokens",
	"alerts",
	"api_keys",
	"deployment_events",
	"deployment_logs",
	"deployments",
	"databases",
	"domains",
	"environment_variables",
	"github_integrations",
	"platform_settings",
	"projects",
	"refresh_tokens",
	"routes",
	"scaling_policies",
	"servers",
	"smtp_settings",
	"volumes",
];

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const db = drizzle(pool, { schema });
setDbProvider(async () => db);

const cleanup = async () => {
	for (const name of TABLE_NAMES) {
		await pool.query(`TRUNCATE TABLE "${name}" CASCADE`);
	}
};

try {
	const {
		createDatabase,
		listAllDatabases,
		listDatabases,
		getDatabaseById,
		updateDatabaseStatus,
		updateDatabaseRuntime,
		deleteDatabase,
	} = await import("../repo");

	await cleanup();

	await pool.query(
		`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-1', 'legacy', 'git', NOW(), NOW())`,
	);

	const standalone = await createDatabase({ name: "orders", type: "postgresql", version: "16" });
	const attached = await createDatabase({
		name: "internal",
		type: "mysql",
		projectId: "proj-1",
		publicAccess: false,
		allowedCidrs: ["10.0.0.0/8"],
	});
	await updateDatabaseStatus(standalone.id, "running", "db-container-1");
	await updateDatabaseRuntime(standalone.id, {
		externalPort: 30123,
		proxyContainerName: "db-container-1-public",
		storageUsedMb: 256,
	});
	const updated = await getDatabaseById(standalone.id);
	console.log(
		JSON.stringify({
			standalone: {
				projectId: standalone.projectId,
				internalPort: standalone.internalPort,
				status: standalone.status,
				publicAccess: standalone.publicAccess,
				allowAnywhere: standalone.allowPublicAccessFromAnywhere,
				volumeName: standalone.volumeName,
				connectionPrefix: standalone.connectionString.slice(0, 11),
				hasPassword: standalone.password.length > 0,
			},
			attached: {
				projectId: attached.projectId,
				publicAccess: attached.publicAccess,
				allowedCidrs: attached.allowedCidrs,
				projectListCount: (await listDatabases("proj-1")).length,
			},
			updated: {
				status: updated?.status,
				containerName: updated?.containerName,
				externalPort: updated?.externalPort,
				proxyContainerName: updated?.proxyContainerName,
				storageUsedMb: updated?.storageUsedMb,
			},
			deleted: await deleteDatabase(attached.id),
			total: (await listAllDatabases()).length,
		}),
	);
} finally {
	await cleanup();
	await pool.end();
}
