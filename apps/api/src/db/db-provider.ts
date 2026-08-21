type DrizzleDb = ReturnType<typeof import("drizzle-orm/bun-sqlite").drizzle>;

let _dbProvider: (() => Promise<DrizzleDb>) | null = null;

export const setDbProvider = (provider: () => Promise<DrizzleDb>) => {
  _dbProvider = provider;
};

export const getDb = async (): Promise<DrizzleDb> => {
  if (_dbProvider) return _dbProvider();
  const { getDrizzle } = await import("../drizzle");
  return getDrizzle();
};
