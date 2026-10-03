import type { Database } from "../../types";
import { MongoStudio } from "./studio/mongo/MongoStudio";
import { RedisStudio } from "./studio/redis/RedisStudio";
import { SqlStudio } from "./studio/SqlStudio";

interface DatabaseStudioProps {
	database: Database;
}

export function DatabaseStudio({ database }: DatabaseStudioProps) {
	if (database.type === "mongodb") {
		return <MongoStudio database={database} />;
	}

	if (database.type === "redis") {
		return <RedisStudio database={database} />;
	}

	return <SqlStudio database={database} />;
}
