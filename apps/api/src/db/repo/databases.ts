import { eq, desc } from "drizzle-orm";
import { getDb } from "../db-provider";
import { databases } from "../schema";
import type { Database, CreateDatabaseInput, DatabaseStatus } from "../../types";
import { randomUUID } from "node:crypto";
import { now, getRowsAffected } from "./helpers";

const mapDatabase = (row: typeof databases.$inferSelect): Database => ({
  id: row.id,
  projectId: row.projectId ?? null,
  name: row.name,
  type: row.type as Database["type"],
  version: row.version,
  databaseName: row.databaseName,
  username: row.username,
  password: row.password,
  internalHost: row.internalHost,
  internalPort: row.internalPort,
  cpuLimit: row.cpuLimit,
  memoryLimitMb: row.memoryLimitMb,
  storageLimitMb: row.storageLimitMb,
  storageUsedMb: row.storageUsedMb,
  publicAccess: Boolean(row.publicAccess),
  allowPublicAccessFromAnywhere: Boolean(row.allowPublicAccessFromAnywhere),
  allowedCidrs: Array.isArray(row.allowedCidrs) ? row.allowedCidrs : (() => {
    try { return JSON.parse(row.allowedCidrs || "[]"); } catch { return []; }
  })(),
  externalPort: row.externalPort,
  proxyContainerName: row.proxyContainerName,
  volumeName: row.volumeName,
  connectionString: row.connectionString,
  status: row.status as DatabaseStatus,
  containerName: row.containerName,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const createDatabase = async (input: CreateDatabaseInput): Promise<Database> => {
  const id = randomUUID();
  const timestamp = now();
  const dbName = `db_${id.slice(0, 8)}`;
  const volumeName = `db-${id.slice(0, 12)}`;
  const username = `user_${id.slice(0, 8)}`;
  const password = randomUUID().replace(/-/g, "").slice(0, 24);
  const internalHost = `db-${id.slice(0, 8)}`;
  const internalPort = input.type === "redis"
    ? 6379
    : input.type === "mongodb"
    ? 27017
    : input.type === "mysql"
    ? 3306
    : 5432;

  let connStr = "";
  if (input.type === "redis") {
    connStr = `redis://:${password}@${internalHost}:${internalPort}`;
  } else if (input.type === "mongodb") {
    connStr = `mongodb://${username}:${password}@${internalHost}:${internalPort}/${dbName}?authSource=admin`;
  } else if (input.type === "mysql") {
    connStr = `mysql://${username}:${password}@${internalHost}:${internalPort}/${dbName}`;
  } else {
    connStr = `postgresql://${username}:${password}@${internalHost}:${internalPort}/${dbName}`;
  }
  const db = await getDb();
  await db.insert(databases).values({
    id,
    projectId: input.projectId ?? null,
    name: input.name,
    type: input.type,
    version: input.version ?? null,
    databaseName: dbName,
    username,
    password,
    internalHost,
    internalPort,
    cpuLimit: input.cpuLimit ?? null,
    memoryLimitMb: input.memoryLimitMb ?? null,
    storageLimitMb: input.storageLimitMb ?? null,
    storageUsedMb: 0,
    publicAccess: input.publicAccess === false ? false : true,
    allowPublicAccessFromAnywhere: input.allowPublicAccessFromAnywhere,
    allowedCidrs: input.allowedCidrs ?? [],
    externalPort: null,
    proxyContainerName: null,
    volumeName,
    connectionString: connStr,
    status: "provisioning",
    createdAt: timestamp,
    updatedAt: timestamp,
  }).execute();
  const [row] = await db.select().from(databases).where(eq(databases.id, id)).execute();
  return mapDatabase(row);
};

export const listAllDatabases = async (): Promise<Database[]> => {
  const db = await getDb();
  const rows = await db.select().from(databases).orderBy(desc(databases.createdAt)).execute();
  return rows.map(mapDatabase);
};

export const listDatabases = async (projectId: string): Promise<Database[]> => {
  const db = await getDb();
  const rows = await db.select().from(databases).where(eq(databases.projectId, projectId)).orderBy(desc(databases.createdAt)).execute();
  return rows.map(mapDatabase);
};

export const getDatabaseById = async (id: string): Promise<Database | null> => {
  const db = await getDb();
  const [row] = await db.select().from(databases).where(eq(databases.id, id)).execute();
  return row ? mapDatabase(row) : null;
};

export const updateDatabaseStatus = async (id: string, status: DatabaseStatus, containerName?: string): Promise<void> => {
  const db = await getDb();
  const updates: Record<string, unknown> = { status, updatedAt: now() };
  if (containerName !== undefined) updates.containerName = containerName;
  await db.update(databases).set(updates).where(eq(databases.id, id)).execute();
};

export const updateDatabaseRuntime = async (id: string, updates: {
  externalPort?: number | null;
  proxyContainerName?: string | null;
  storageUsedMb?: number;
  status?: DatabaseStatus;
}): Promise<void> => {
  const db = await getDb();
  await db.update(databases).set({ ...updates, updatedAt: now() }).where(eq(databases.id, id)).execute();
};

export const deleteDatabase = async (id: string): Promise<boolean> => {
  const db = await getDb();
  return getRowsAffected(await db.delete(databases).where(eq(databases.id, id)).execute()) > 0;
};
