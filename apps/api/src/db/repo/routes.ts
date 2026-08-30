import { and, eq, desc, isNull, isNotNull } from "drizzle-orm";
import { routes } from "../schema";
import { getDb } from "../db-provider";
import type { Route, RouteStatus, UpsertRouteInput } from "../../types";
import { randomUUID } from "node:crypto";
import { now } from "./helpers";

export const mapRoute = (row: typeof routes.$inferSelect): Route => ({
  id: row.id,
  serverId: row.serverId,
  deploymentId: row.deploymentId,
  projectId: row.projectId,
  hostname: row.hostname,
  routeFile: row.routeFile,
  port: row.port,
  targetContainers: row.targetContainers,
  upstreamHost: row.upstreamHost,
  status: row.status as RouteStatus,
  lastError: row.lastError,
  confirmedAt: row.confirmedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const upsertRoute = async (input: UpsertRouteInput): Promise<Route> => {
  const db = await getDb();
  const timestamp = now();
  const id = randomUUID();

  const existing = input.serverId
    ? (await db.select().from(routes).where(and(eq(routes.hostname, input.hostname), eq(routes.serverId, input.serverId))).execute())[0]
    : (await db.select().from(routes).where(and(eq(routes.hostname, input.hostname), isNull(routes.serverId))).execute())[0];

  if (existing) {
    const nextStatus = existing.status === 'active' ? 'active' : (input.status ?? existing.status);
    await db.update(routes).set({
      serverId: input.serverId ?? null,
      deploymentId: input.deploymentId ?? null,
      projectId: input.projectId ?? null,
      routeFile: input.routeFile,
      port: input.port,
      targetContainers: input.targetContainers,
      upstreamHost: input.upstreamHost ?? null,
      status: nextStatus,
      lastError: input.lastError ?? null,
      confirmedAt: nextStatus === 'active' ? timestamp : existing.confirmedAt,
      updatedAt: timestamp,
    }).where(eq(routes.id, existing.id)).execute();
    const [row] = await db.select().from(routes).where(eq(routes.id, existing.id)).execute();
    return mapRoute(row);
  }

  try {
    await db.insert(routes).values({
      id,
      serverId: input.serverId ?? null,
      deploymentId: input.deploymentId ?? null,
      projectId: input.projectId ?? null,
      hostname: input.hostname,
      routeFile: input.routeFile,
      port: input.port,
      targetContainers: input.targetContainers,
      upstreamHost: input.upstreamHost ?? null,
      status: input.status ?? "pending",
      lastError: input.lastError ?? null,
      confirmedAt: input.status === "active" ? timestamp : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).execute();
    const [row] = await db.select().from(routes).where(eq(routes.id, id)).execute();
    return mapRoute(row);
  } catch {
    const retry = input.serverId
      ? (await db.select().from(routes).where(and(eq(routes.hostname, input.hostname), eq(routes.serverId, input.serverId))).execute())[0]
      : (await db.select().from(routes).where(and(eq(routes.hostname, input.hostname), isNull(routes.serverId))).execute())[0];
    if (!retry) throw new Error("Failed to create route");
    const nextStatus = retry.status === 'active' ? 'active' : (input.status ?? retry.status);
    await db.update(routes).set({
      deploymentId: input.deploymentId ?? null,
      projectId: input.projectId ?? null,
      routeFile: input.routeFile,
      port: input.port,
      targetContainers: input.targetContainers,
      upstreamHost: input.upstreamHost ?? null,
      status: nextStatus,
      lastError: input.lastError ?? null,
      confirmedAt: nextStatus === 'active' ? timestamp : retry.confirmedAt,
      updatedAt: timestamp,
    }).where(eq(routes.id, retry.id)).execute();
    const [row] = await db.select().from(routes).where(eq(routes.id, retry.id)).execute();
    return mapRoute(row);
  }
};

export const getRouteByHostname = async (hostname: string, serverId?: string): Promise<Route | null> => {
  const db = await getDb();
  const row = serverId
    ? (await db.select().from(routes).where(and(eq(routes.hostname, hostname), eq(routes.serverId, serverId))).execute())[0]
    : (await db.select().from(routes).where(eq(routes.hostname, hostname)).orderBy(desc(routes.createdAt)).execute())[0];
  return row ? mapRoute(row) : null;
};

export const listRoutes = async (serverId?: string): Promise<Route[]> => {
  const db = await getDb();
  const rows = serverId
    ? await db.select().from(routes).where(eq(routes.serverId, serverId)).orderBy(desc(routes.createdAt)).execute()
    : await db.select().from(routes).orderBy(desc(routes.createdAt)).execute();
  return rows.map(mapRoute);
};

export const updateRouteStatus = async (
  hostname: string,
  status: RouteStatus,
  lastError?: string | null,
  serverId?: string,
): Promise<void> => {
  const db = await getDb();
  const patch = {
    status,
    lastError: lastError ?? null,
    confirmedAt: status === "active" ? now() : null,
    updatedAt: now(),
  };
  if (serverId) {
    await db.update(routes).set(patch).where(and(eq(routes.hostname, hostname), eq(routes.serverId, serverId))).execute();
  } else {
    await db.update(routes).set(patch).where(eq(routes.hostname, hostname)).execute();
  }
};

export const deleteRouteByHostname = async (hostname: string, serverId?: string): Promise<void> => {
  const db = await getDb();
  if (serverId) {
    await db.delete(routes).where(and(eq(routes.hostname, hostname), eq(routes.serverId, serverId))).execute();
  } else {
    await db.delete(routes).where(eq(routes.hostname, hostname)).execute();
  }
};

export const deleteRoutesByDeployment = async (deploymentId: string): Promise<void> => {
  const db = await getDb();
  await db.delete(routes).where(eq(routes.deploymentId, deploymentId)).execute();
};

export const deleteRoute = async (id: string): Promise<void> => {
  const db = await getDb();
  await db.delete(routes).where(eq(routes.id, id)).execute();
};

export const listIngressRoutes = async (): Promise<Route[]> => {
  const db = await getDb();
  const rows = await db.select().from(routes).where(and(isNotNull(routes.upstreamHost), eq(routes.status, "active"))).execute();
  return rows.map(mapRoute);
};
