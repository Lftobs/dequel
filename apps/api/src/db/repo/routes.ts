import { and, eq, desc, isNull } from "drizzle-orm";
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
  targetContainers: JSON.parse(row.targetContainers),
  upstreamHost: row.upstreamHost,
  status: row.status as RouteStatus,
  lastError: row.lastError,
  confirmedAt: row.confirmedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const upsertRoute = async (input: UpsertRouteInput): Promise<Route> => {
  const db = await getDb();
  const existing = input.serverId
    ? db.select().from(routes).where(and(eq(routes.hostname, input.hostname), eq(routes.serverId, input.serverId))).get()
    : db.select().from(routes).where(and(eq(routes.hostname, input.hostname), isNull(routes.serverId))).get();
  const timestamp = now();
  if (existing) {
    const nextStatus = existing.status === 'active' ? 'active' : (input.status ?? existing.status);
    db.update(routes).set({
      serverId: input.serverId ?? null,
      deploymentId: input.deploymentId ?? null,
      projectId: input.projectId ?? null,
      routeFile: input.routeFile,
      port: input.port,
      targetContainers: JSON.stringify(input.targetContainers),
      upstreamHost: input.upstreamHost ?? null,
      status: nextStatus,
      lastError: input.lastError ?? null,
      confirmedAt: nextStatus === 'active' ? timestamp : existing.confirmedAt,
      updatedAt: timestamp,
    }).where(eq(routes.id, existing.id)).run();
    const row = db.select().from(routes).where(eq(routes.id, existing.id)).get()!;
    return mapRoute(row);
  }
  const id = randomUUID();
  db.insert(routes).values({
    id,
    serverId: input.serverId ?? null,
    deploymentId: input.deploymentId ?? null,
    projectId: input.projectId ?? null,
    hostname: input.hostname,
    routeFile: input.routeFile,
    port: input.port,
    targetContainers: JSON.stringify(input.targetContainers),
    upstreamHost: input.upstreamHost ?? null,
    status: input.status ?? "pending",
    lastError: input.lastError ?? null,
    confirmedAt: input.status === "active" ? timestamp : null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  const row = db.select().from(routes).where(eq(routes.id, id)).get()!;
  return mapRoute(row);
};

export const getRouteByHostname = async (hostname: string, serverId?: string): Promise<Route | null> => {
  const db = await getDb();
  const row = serverId
    ? db.select().from(routes).where(and(eq(routes.hostname, hostname), eq(routes.serverId, serverId))).get()
    : db.select().from(routes).where(eq(routes.hostname, hostname)).orderBy(desc(routes.createdAt)).get();
  return row ? mapRoute(row) : null;
};

export const listRoutes = async (serverId?: string): Promise<Route[]> => {
  const db = await getDb();
  const rows = serverId
    ? db.select().from(routes).where(eq(routes.serverId, serverId)).orderBy(desc(routes.createdAt)).all()
    : db.select().from(routes).orderBy(desc(routes.createdAt)).all();
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
    db.update(routes).set(patch).where(and(eq(routes.hostname, hostname), eq(routes.serverId, serverId))).run();
  } else {
    db.update(routes).set(patch).where(eq(routes.hostname, hostname)).run();
  }
};

export const deleteRouteByHostname = async (hostname: string, serverId?: string): Promise<void> => {
  const db = await getDb();
  if (serverId) {
    db.delete(routes).where(and(eq(routes.hostname, hostname), eq(routes.serverId, serverId))).run();
  } else {
    db.delete(routes).where(eq(routes.hostname, hostname)).run();
  }
};

export const deleteRoutesByDeployment = async (deploymentId: string): Promise<void> => {
  const db = await getDb();
  db.delete(routes).where(eq(routes.deploymentId, deploymentId)).run();
};
