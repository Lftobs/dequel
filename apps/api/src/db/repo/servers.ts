import { eq, desc } from "drizzle-orm";
import { getDrizzle } from "../drizzle";
import { servers } from "../schema";
import type { Server, CreateServerInput, ServerStatus } from "../../types";
import { randomUUID } from "node:crypto";
import { now } from "./helpers";

const mapServer = (row: typeof servers.$inferSelect): Server => ({
  id: row.id,
  name: row.name,
  host: row.host,
  port: row.port,
  authToken: row.authToken,
  status: row.status as ServerStatus,
  cpuTotal: row.cpuTotal,
  memoryTotalMb: row.memoryTotalMb,
  diskTotalMb: row.diskTotalMb,
  cpuUsedPercent: row.cpuUsedPercent,
  memoryUsedMb: row.memoryUsedMb,
  lastHeartbeat: row.lastHeartbeat,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const createServer = async (input: CreateServerInput): Promise<Server> => {
  const id = randomUUID();
  const timestamp = now();
  const db = await getDrizzle();
  db.insert(servers).values({
    id,
    name: input.name,
    host: input.host,
    port: input.port ?? 2375,
    authToken: input.authToken,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  const row = db.select().from(servers).where(eq(servers.id, id)).get()!;
  return mapServer(row);
};

export const listServers = async (): Promise<Server[]> => {
  const db = await getDrizzle();
  return db.select().from(servers).orderBy(servers.name).all().map(mapServer);
};

export const getServerById = async (id: string): Promise<Server | null> => {
  const db = await getDrizzle();
  const row = db.select().from(servers).where(eq(servers.id, id)).get();
  return row ? mapServer(row) : null;
};

export const updateServerStatus = async (id: string, status: ServerStatus, resources?: {
  cpuTotal?: number; memoryTotalMb?: number; diskTotalMb?: number;
  cpuUsedPercent?: number; memoryUsedMb?: number;
}): Promise<void> => {
  const db = await getDrizzle();
  const updates: Record<string, unknown> = { status, updatedAt: now() };
  if (resources) {
    if (resources.cpuTotal !== undefined) updates.cpuTotal = resources.cpuTotal;
    if (resources.memoryTotalMb !== undefined) updates.memoryTotalMb = resources.memoryTotalMb;
    if (resources.diskTotalMb !== undefined) updates.diskTotalMb = resources.diskTotalMb;
    if (resources.cpuUsedPercent !== undefined) updates.cpuUsedPercent = resources.cpuUsedPercent;
    if (resources.memoryUsedMb !== undefined) updates.memoryUsedMb = resources.memoryUsedMb;
    updates.lastHeartbeat = now();
  }
  db.update(servers).set(updates).where(eq(servers.id, id)).run();
};

export const deleteServer = async (id: string): Promise<boolean> => {
  const db = await getDrizzle();
  return db.delete(servers).where(eq(servers.id, id)).run().changes > 0;
};
