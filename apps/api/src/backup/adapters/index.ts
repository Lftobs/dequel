import type { BackupAdapter } from "../adapter";
import type { DatabaseType } from "../types";
import { mongoAdapter } from "./mongodb";
import { mysqlAdapter } from "./mysql";
import { postgresAdapter } from "./postgres";
import { redisAdapter } from "./redis";

const adapters: Record<DatabaseType, BackupAdapter> = {
	postgresql: postgresAdapter,
	mysql: mysqlAdapter,
	redis: redisAdapter,
	mongodb: mongoAdapter,
};

export function getAdapter(engine: DatabaseType): BackupAdapter {
	const adapter = adapters[engine];
	if (!adapter) throw new Error(`No backup adapter for engine: ${engine}`);
	return adapter;
}
