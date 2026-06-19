import { eq, desc } from "drizzle-orm";
import { getDrizzle } from "../drizzle";
import { databases } from "../schema";
import type { Database, CreateDatabaseInput, DatabaseStatus } from "../../types";
import { randomUUID } from "node:crypto";
import { now } from "./helpers";

const mapDatabase = (row: typeof databases.$inferSelect): Database => ({
  id: row.id,
  projectId: row.projectId,
  type: row.type as Database["type"],
  version: row.version,
  databaseName: row.databaseName,
  username: row.username,
  password: row.password,
  internalHost: row.internalHost,
  internalPort: row.internalPort,
  cpuLimit: row.cpuLimit,
  memoryLimitMb: row.memoryLimitMb,
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
  const username = `user_${id.slice(0, 8)}`;
  const password = randomUUID().replace(/-/g, "").slice(0, 24);
  const internalHost = `db-${id.slice(0, 8)}`;
  const internalPort = input.type === "mysql" ? 3306 : 5432;
  const connStr = input.type === "mysql"
    ? `mysql://${username}:${password}@${internalHost}:${internalPort}/${dbName}`
    : `postgresql://${username}:${password}@${internalHost}:${internalPort}/${dbName}`;
  const db = await getDrizzle();
  db.insert(databases).values({
    id,
    projectId: input.projectId,
    type: input.type,
    version: input.version ?? null,
    databaseName: dbName,
    username,
    password,
    internalHost,
    internalPort,
    cpuLimit: input.cpuLimit ?? null,
    memoryLimitMb: input.memoryLimitMb ?? null,
    connectionString: connStr,
    status: "provisioning",
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  const row = db.select().from(databases).where(eq(databases.id, id)).get()!;
  return mapDatabase(row);
};

export const listAllDatabases = async (): Promise<Database[]> => {
  const db = await getDrizzle();
  return db.select().from(databases).orderBy(desc(databases.createdAt)).all().map(mapDatabase);
};

export const listDatabases = async (projectId: string): Promise<Database[]> => {
  const db = await getDrizzle();
  return db.select().from(databases).where(eq(databases.projectId, projectId)).orderBy(desc(databases.createdAt)).all().map(mapDatabase);
};

export const getDatabaseById = async (id: string): Promise<Database | null> => {
  const db = await getDrizzle();
  const row = db.select().from(databases).where(eq(databases.id, id)).get();
  return row ? mapDatabase(row) : null;
};

export const updateDatabaseStatus = async (id: string, status: DatabaseStatus, containerName?: string): Promise<void> => {
  const db = await getDrizzle();
  const updates: Record<string, unknown> = { status, updatedAt: now() };
  if (containerName !== undefined) updates.containerName = containerName;
  db.update(databases).set(updates).where(eq(databases.id, id)).run();
};

export const deleteDatabase = async (id: string): Promise<boolean> => {
  const db = await getDrizzle();
  return db.delete(databases).where(eq(databases.id, id)).run().changes > 0;
};
