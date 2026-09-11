type DrizzleDb = ReturnType<typeof import("drizzle-orm/node-postgres").drizzle>;

let _dbProvider: (() => Promise<DrizzleDb>) | null = null;

export const setDbProvider = (provider: () => Promise<DrizzleDb>) => {
	_dbProvider = provider;
};

export const getDb = async (): Promise<DrizzleDb> => {
	if (_dbProvider) return _dbProvider();
	const { getDb: getClient } = await import("./client");
	return getClient();
};
