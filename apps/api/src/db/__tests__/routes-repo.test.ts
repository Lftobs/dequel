import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { and, eq, desc, isNull } from 'drizzle-orm';
import * as schema from '../schema';
import { routes } from '../schema';
import { randomUUID } from 'node:crypto';
import { setDbProvider, getDb } from '../db-provider';

const fileUrl = (rel: string) => new URL(rel, import.meta.url).href;
const now = () => new Date().toISOString();

const mapRoute = (row: typeof routes.$inferSelect) => ({
  id: row.id,
  serverId: row.serverId,
  deploymentId: row.deploymentId,
  projectId: row.projectId,
  hostname: row.hostname,
  routeFile: row.routeFile,
  port: row.port,
  targetContainers: JSON.parse(row.targetContainers),
  upstreamHost: row.upstreamHost,
  status: row.status,
  lastError: row.lastError,
  confirmedAt: row.confirmedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const upsertRoute = async (input: any) => {
  const db = await getDb();
  const existing = input.serverId
    ? db.select().from(routes).where(and(eq(routes.hostname, input.hostname), eq(routes.serverId, input.serverId))).get()
    : db.select().from(routes).where(and(eq(routes.hostname, input.hostname), isNull(routes.serverId))).get();
  const ts = now();
  if (existing) {
    const nextStatus = existing.status === 'active' ? 'active' : (input.status ?? existing.status);
    db.update(routes).set({
      serverId: input.serverId ?? null, deploymentId: input.deploymentId ?? null,
      projectId: input.projectId ?? null, routeFile: input.routeFile,
      port: input.port, targetContainers: JSON.stringify(input.targetContainers),
      upstreamHost: input.upstreamHost ?? null, status: nextStatus,
      lastError: input.lastError ?? null,
      confirmedAt: nextStatus === 'active' ? ts : existing.confirmedAt, updatedAt: ts,
    }).where(eq(routes.id, existing.id)).run();
    return mapRoute(db.select().from(routes).where(eq(routes.id, existing.id)).get()!);
  }
  const id = randomUUID();
  db.insert(routes).values({
    id, serverId: input.serverId ?? null, deploymentId: input.deploymentId ?? null,
    projectId: input.projectId ?? null, hostname: input.hostname, routeFile: input.routeFile,
    port: input.port, targetContainers: JSON.stringify(input.targetContainers),
    upstreamHost: input.upstreamHost ?? null, status: input.status ?? "pending",
    lastError: input.lastError ?? null,
    confirmedAt: input.status === "active" ? ts : null, createdAt: ts, updatedAt: ts,
  }).run();
  return mapRoute(db.select().from(routes).where(eq(routes.id, id)).get()!);
};

const getRouteByHostname = async (hostname: string, serverId?: string) => {
  const db = await getDb();
  const row = serverId
    ? db.select().from(routes).where(and(eq(routes.hostname, hostname), eq(routes.serverId, serverId))).get()
    : db.select().from(routes).where(eq(routes.hostname, hostname)).orderBy(desc(routes.createdAt)).get();
  return row ? mapRoute(row) : null;
};

const listRoutes = async (serverId?: string) => {
  const db = await getDb();
  const rows = serverId
    ? db.select().from(routes).where(eq(routes.serverId, serverId)).orderBy(desc(routes.createdAt)).all()
    : db.select().from(routes).orderBy(desc(routes.createdAt)).all();
  return rows.map(mapRoute);
};

const updateRouteStatus = async (hostname: string, status: string, lastError?: string | null, serverId?: string) => {
  const db = await getDb();
  const patch = { status, lastError: lastError ?? null, confirmedAt: status === "active" ? now() : null, updatedAt: now() };
  if (serverId) {
    db.update(routes).set(patch).where(and(eq(routes.hostname, hostname), eq(routes.serverId, serverId))).run();
  } else {
    db.update(routes).set(patch).where(eq(routes.hostname, hostname)).run();
  }
};

const deleteRouteByHostname = async (hostname: string, serverId?: string) => {
  const db = await getDb();
  if (serverId) {
    db.delete(routes).where(and(eq(routes.hostname, hostname), eq(routes.serverId, serverId))).run();
  } else {
    db.delete(routes).where(eq(routes.hostname, hostname)).run();
  }
};

const deleteRoutesByDeployment = async (deploymentId: string) => {
  const db = await getDb();
  db.delete(routes).where(eq(routes.deploymentId, deploymentId)).run();
};

mock.module(fileUrl('../repo/routes'), () => ({
  upsertRoute, getRouteByHostname, listRoutes, updateRouteStatus, deleteRouteByHostname, deleteRoutesByDeployment,
}));

let db: Database;
let dir: string;
let repo: typeof import('../repo/routes');

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'dequel-routes-test-'));
  db = new Database(join(dir, 'test.db'));
  db.exec(`
    CREATE TABLE routes (
      id text PRIMARY KEY NOT NULL,
      server_id text, deployment_id text, project_id text,
      hostname text NOT NULL, route_file text NOT NULL,
      port integer NOT NULL, target_containers text NOT NULL,
      upstream_host text, status text DEFAULT 'pending' NOT NULL,
      last_error text, confirmed_at text,
      created_at text NOT NULL, updated_at text NOT NULL
    );
    CREATE UNIQUE INDEX idx_routes_hostname_server ON routes (hostname, server_id);
  `);
  const drizzleDb = drizzle(db, { schema });
  setDbProvider(async () => drizzleDb);
  repo = await import('../repo/routes');
});

afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('routes repo', () => {
  it('upserts a pending route and lists it', async () => {
    const route = await repo.upsertRoute({
      hostname: 'app.localhost:80',
      routeFile: 'app.caddy',
      port: 3000,
      targetContainers: ['deploy-dep-1'],
      deploymentId: 'dep-1',
      projectId: 'proj-1',
      serverId: null,
      status: 'pending',
    });
    expect(route.status).toBe('pending');
    expect(route.confirmedAt).toBeNull();
    const listed = await repo.listRoutes();
    expect(listed).toHaveLength(1);
    expect(listed[0].targetContainers).toEqual(['deploy-dep-1']);
  });

  it('marks a route active with confirmation timestamp', async () => {
    await repo.updateRouteStatus('app.localhost:80', 'active');
    const route = await repo.getRouteByHostname('app.localhost:80');
    expect(route?.status).toBe('active');
    expect(route?.confirmedAt).not.toBeNull();
  });

  it('upserting over an active route keeps it active and updates targets', async () => {
    await repo.upsertRoute({
      hostname: 'app.localhost:80',
      routeFile: 'app.caddy',
      port: 3000,
      targetContainers: ['deploy-dep-1', 'deploy-dep-1-replica-2'],
      deploymentId: 'dep-1',
      projectId: 'proj-1',
      serverId: null,
      status: 'pending',
    });
    const route = await repo.getRouteByHostname('app.localhost:80');
    expect(route?.status).toBe('active');
    expect(route?.confirmedAt).not.toBeNull();
    expect(route?.targetContainers).toEqual(['deploy-dep-1', 'deploy-dep-1-replica-2']);
  });

  it('marks a route failed with an error message', async () => {
    await repo.updateRouteStatus('app.localhost:80', 'failed', 'Caddy reload failed');
    const route = await repo.getRouteByHostname('app.localhost:80');
    expect(route?.status).toBe('failed');
    expect(route?.lastError).toBe('Caddy reload failed');
    expect(route?.confirmedAt).toBeNull();
  });

  it('filters routes by server', async () => {
    await repo.upsertRoute({
      hostname: 'other.localhost:80',
      routeFile: 'other.caddy',
      port: 8080,
      targetContainers: ['deploy-other-1'],
      deploymentId: 'dep-2',
      projectId: 'proj-2',
      serverId: 'server-1',
    });
    const mine = await repo.listRoutes('server-1');
    expect(mine).toHaveLength(1);
    expect(mine[0].hostname).toBe('other.localhost:80');
  });

  it('deletes routes by deployment', async () => {
    await repo.deleteRoutesByDeployment('dep-1');
    const remaining = await repo.listRoutes();
    expect(remaining.map((r) => r.deploymentId)).toEqual(['dep-2']);
    expect(await repo.getRouteByHostname('app.localhost:80')).toBeNull();
  });

  it('deletes a route by hostname', async () => {
    await repo.deleteRouteByHostname('other.localhost:80');
    expect(await repo.listRoutes()).toHaveLength(0);
  });

  it('keeps separate rows per server for the same hostname', async () => {
    await repo.upsertRoute({
      hostname: 'shared.localhost:80',
      routeFile: 'shared.caddy',
      port: 3000,
      targetContainers: ['deploy-dep-3'],
      deploymentId: 'dep-3',
      projectId: 'proj-3',
      serverId: 'server-ingress',
      upstreamHost: '203.0.113.10',
      status: 'pending',
    });
    const local = await repo.getRouteByHostname('shared.localhost:80', 'server-ingress');
    expect(local?.upstreamHost).toBe('203.0.113.10');
    const projectRoute = await repo.upsertRoute({
      hostname: 'shared.localhost:80',
      routeFile: 'shared.caddy',
      port: 3000,
      targetContainers: ['deploy-dep-3'],
      deploymentId: 'dep-3',
      projectId: 'proj-3',
      serverId: 'server-2',
      status: 'active',
    });
    expect(projectRoute.upstreamHost).toBeNull();
    expect(await repo.listRoutes('server-ingress')).toHaveLength(1);
    expect(await repo.listRoutes('server-2')).toHaveLength(1);
  });
});
