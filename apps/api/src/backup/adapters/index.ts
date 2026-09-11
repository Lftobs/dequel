import type { DatabaseType } from "../types";
import type { BackupAdapter } from "../adapter";
import { postgresAdapter } from "./postgres";
import { mysqlAdapter } from "./mysql";
import { redisAdapter } from "./redis";
import { mongoAdapter } from "./mongodb";

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
