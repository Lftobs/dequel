import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../utils/config";
import * as schema from "./schema";

let pool: Pool | null = null;
let instance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const getDb = async () => {
	if (!instance) {
		pool = new Pool({ connectionString: config.databaseUrl });
		instance = drizzle(pool, { schema });
	}
	return instance;
};

export const closeDb = async () => {
	if (pool) {
		await pool.end();
		pool = null;
		instance = null;
	}
};
