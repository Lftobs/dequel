import { drizzle } from "drizzle-orm/bun-sqlite";
import { getDb } from "./client";
import * as schema from "./schema";

let instance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const getDrizzle = async () => {
  if (!instance) {
    const sqlite = await getDb();
    instance = drizzle(sqlite, { schema });
  }
  return instance;
};
