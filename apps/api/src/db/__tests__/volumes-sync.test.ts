import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { setDbProvider } from "../db-provider";
import { isComposeStackVolume, listVolumes, syncComposeStackVolumes } from "../repo/volumes";
import * as schema from "../schema";
import { createTestPool, truncateAllTables } from "../test-helper";

let pool: Pool;
const PROJECT_ID = "vol-sync-proj-1";

const seed = async () => {
	await pool.query(
		`INSERT INTO projects (id, name, source_type, created_at, updated_at)
		 VALUES ($1, 'Volumes Sync Project', 'upload', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
		[PROJECT_ID],
	);
};

beforeAll(async () => {
	pool = createTestPool();
	const db = drizzle(pool, { schema });
	setDbProvider(async () => db);
	await truncateAllTables(pool);
	await seed();
});

afterAll(async () => {
	if (pool) await pool.end();
});

describe("compose stack volume sync", () => {
	it("registers compose volumes with joined mount paths", async () => {
		await syncComposeStackVolumes(PROJECT_ID, [
			{ volumeKey: "dq-volsyncproj1-wp-db", containerPath: "/var/lib/mysql" },
			{ volumeKey: "dq-volsyncproj1-wp-db", containerPath: "/var/lib/mysql2" },
			{ volumeKey: "dq-volsyncproj1-wp-content", containerPath: "/var/www/html" },
		]);
		const rows = await listVolumes(PROJECT_ID);
		expect(rows).toHaveLength(2);
		const dbVolume = rows.find((v) => v.dockerVolumeName === "dq-volsyncproj1-wp-db");
		expect(dbVolume?.mountPath).toBe("/var/lib/mysql, /var/lib/mysql2");
		expect(rows.find((v) => v.dockerVolumeName === "dq-volsyncproj1-wp-content")?.mountPath).toBe("/var/www/html");
	});

	it("is idempotent and prunes dropped compose volumes while keeping platform volumes", async () => {
		await syncComposeStackVolumes(PROJECT_ID, [
			{ volumeKey: "dq-volsyncproj1-wp-db", containerPath: "/var/lib/mysql" },
		]);
		const rows = await listVolumes(PROJECT_ID);
		expect(rows).toHaveLength(1);
		expect(rows.find((v) => v.dockerVolumeName === "dq-volsyncproj1-wp-db")?.mountPath).toBe("/var/lib/mysql");
		expect(rows.find((v) => v.dockerVolumeName === "dq-volsyncproj1-wp-content")).toBeUndefined();

		await pool.query(
			`INSERT INTO volumes (id, project_id, mount_path, docker_volume_name, created_at)
			 VALUES ('vol-platform-keep', $1, '/app/data', 'vol-ab12cd34', NOW()) ON CONFLICT (id) DO NOTHING`,
			[PROJECT_ID],
		);
		await syncComposeStackVolumes(PROJECT_ID, [
			{ volumeKey: "dq-volsyncproj1-wp-db", containerPath: "/var/lib/mysql" },
		]);
		const after = await listVolumes(PROJECT_ID);
		expect(after).toHaveLength(2);
		expect(after.find((v) => v.dockerVolumeName === "vol-ab12cd34")).toBeDefined();
		expect(after.find((v) => v.dockerVolumeName === "dq-volsyncproj1-wp-db")).toBeDefined();
	});

	it("identifies compose volumes by stable name prefix", () => {
		expect(isComposeStackVolume("dq-volsyncproj1-wp-db", "vol-sync-proj-1")).toBe(true);
		expect(isComposeStackVolume("dq-a08b4c0da2084fb58617-umami-db", "a08b4c0d-a208-4fb5-8617-6b43db10c74c")).toBe(true);
		expect(isComposeStackVolume("vol-ab12cd34", "vol-sync-proj-1")).toBe(false);
		expect(isComposeStackVolume(null, "vol-sync-proj-1")).toBe(false);
	});
});
