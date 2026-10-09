import { migrate as drizzleMigrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "./client";

export const migrate = async () => {
	const db = await getDb();
	const migrationsFolder = `${import.meta.dirname}/migrations`;

	try {
		await drizzleMigrate(db, { migrationsFolder });
	} catch (err: any) {
		const msg = err?.message ?? String(err);
		const innerCode = err?.cause?.code;
		if (err?.code === "42P07" || innerCode === "42P07" || msg.includes("already exists")) {
			console.log("[Migrate] Some tables already exist, continuing");
		} else {
			console.error("[Migrate] Migration failed:", msg);
			throw err;
		}
	}
};
