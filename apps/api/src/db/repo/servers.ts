import { eq, desc } from "drizzle-orm";
import { getDb } from "../db-provider";
import { servers } from "../schema";
import type { Server, CreateServerInput, ServerMode, ServerStatus } from "../../types";
import { randomUUID } from "node:crypto";
import { now, getRowsAffected } from "./helpers";

const mapServer = (row: typeof servers.$inferSelect): Server => ({
  id: row.id,
  name: row.name,
  host: row.host,
  port: row.port,
  mode: row.mode as ServerMode,
  sshUser: row.sshUser ?? null,
  agentId: row.agentId,
  agentVersion: row.agentVersion,
  capabilities: parseJsonObject(row.capabilities),
  labels: parseJsonObject(row.labels) as Record<string, string>,
  status: row.status as ServerStatus,
  cpuTotal: row.cpuTotal,
  memoryTotalMb: row.memoryTotalMb,
  diskTotalMb: row.diskTotalMb,
  cpuUsedPercent: row.cpuUsedPercent,
  memoryUsedMb: row.memoryUsedMb,
  lastHeartbeat: row.lastHeartbeat,
  registeredAt: row.registeredAt,
  revokedAt: row.revokedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const parseJsonObject = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const createServer = async (input: CreateServerInput): Promise<Server> => {
  const id = randomUUID();
  const timestamp = now();
  const db = await getDb();
  await db.insert(servers).values({
    id,
    name: input.name,
    host: input.host,
    port: input.port ?? 2375,
    authToken: input.authToken ?? "",
    sshUser: input.sshUser ?? null,
    mode: input.mode ?? "ssh",
    status: "pending",
    capabilities: input.mode === "local" ? { docker: true, buildkit: true, caddy: true, compose: true } : undefined,
    labels: input.mode === "local" ? {} : undefined,
    registeredAt: input.mode === "local" ? timestamp : undefined,
    lastHeartbeat: input.mode === "local" ? timestamp : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).execute();
  const [row] = await db.select().from(servers).where(eq(servers.id, id)).execute();
  return mapServer(row);
};

export interface ServerConnection {
  id: string;
  host: string;
  port: number;
  authToken: string;
  mode: ServerMode;
}

export const listServerConnections = async (): Promise<ServerConnection[]> => {
  const db = await getDb();
  const rows = await db.select({
    id: servers.id,
    host: servers.host,
    port: servers.port,
    authToken: servers.authToken,
    mode: servers.mode,
  }).from(servers).execute();
  return rows.map((row) => ({
    ...row,
    mode: row.mode as ServerMode,
  }));
};

export const ensureLocalServer = async (): Promise<Server> => {
  const existing = await getServerById("local");
  if (existing) return existing;
  const timestamp = now();
  const db = await getDb();
  await db.insert(servers).values({
    id: "local",
    name: "Local server",
    host: "127.0.0.1",
    port: 22,
    authToken: "",
    mode: "local",
    status: "connected",
    capabilities: { docker: true, buildkit: true, caddy: true, compose: true },
    labels: {},
    registeredAt: timestamp,
    lastHeartbeat: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).execute();
  return getServerById("local") as Promise<Server>;
};

export const listServers = async (): Promise<Server[]> => {
  const db = await getDb();
  const rows = await db.select().from(servers).orderBy(servers.name).execute();
  return rows.map(mapServer);
};

export const getServerById = async (id: string): Promise<Server | null> => {
  const db = await getDb();
  const [row] = await db.select().from(servers).where(eq(servers.id, id)).execute();
  return row ? mapServer(row) : null;
};

export const updateServerStatus = async (id: string, status: ServerStatus, resources?: {
  cpuTotal?: number; memoryTotalMb?: number; diskTotalMb?: number;
  cpuUsedPercent?: number; memoryUsedMb?: number;
}): Promise<void> => {
  const db = await getDb();
  const updates: Record<string, unknown> = { status, updatedAt: now() };
  if (resources) {
    if (resources.cpuTotal !== undefined) updates.cpuTotal = resources.cpuTotal;
    if (resources.memoryTotalMb !== undefined) updates.memoryTotalMb = resources.memoryTotalMb;
    if (resources.diskTotalMb !== undefined) updates.diskTotalMb = resources.diskTotalMb;
    if (resources.cpuUsedPercent !== undefined) updates.cpuUsedPercent = resources.cpuUsedPercent;
    if (resources.memoryUsedMb !== undefined) updates.memoryUsedMb = resources.memoryUsedMb;
    updates.lastHeartbeat = now();
  }
  await db.update(servers).set(updates).where(eq(servers.id, id)).execute();
};

export const deleteServer = async (id: string): Promise<boolean> => {
  const db = await getDb();
  return getRowsAffected(await db.delete(servers).where(eq(servers.id, id)).execute()) > 0;
};
