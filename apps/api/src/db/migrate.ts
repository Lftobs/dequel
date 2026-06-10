import { migrate as drizzleMigrate } from "drizzle-orm/bun-sqlite/migrator";
import { getDrizzle } from "./drizzle";

export const migrate = async () => {
  const db = await getDrizzle();
  drizzleMigrate(db, { migrationsFolder: import.meta.dirname + "/migrations" });
};
