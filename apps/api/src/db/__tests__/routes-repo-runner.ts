import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';
import { setDbProvider } from '../db-provider';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://dequel:dequel@localhost:5433/dequel';
const TABLE_NAMES = [
  'agent_credentials', 'agent_jobs', 'agent_registration_tokens', 'alerts', 'api_keys',
  'deployment_events', 'deployment_logs', 'deployments', 'databases', 'domains', 'environment_variables',
  'github_integrations', 'platform_settings', 'projects', 'refresh_tokens', 'routes',
  'scaling_policies', 'servers', 'smtp_settings', 'volumes',
];

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const db = drizzle(pool, { schema });
setDbProvider(async () => db);

const truncate = async () => {
  for (const name of TABLE_NAMES) {
    await pool.query(`TRUNCATE TABLE "${name}" CASCADE`);
  }
};

try {
  const { upsertRoute, listRoutes, getRouteByHostname, updateRouteStatus, deleteRoutesByDeployment } = await import('../repo/routes');

  await truncate();
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-1', 'Test', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-2', 'Test2', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-3', 'Test3', 'git', NOW(), NOW())`);

  const upsert = await upsertRoute({
    hostname: 'app.localhost:80',
    routeFile: 'app.caddy',
    port: 3000,
    targetContainers: ['deploy-dep-1'],
    deploymentId: 'dep-1',
    projectId: 'proj-1',
    serverId: null,
    status: 'pending',
  });
  const listAfterUpsert = await listRoutes();

  await truncate();
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-1', 'Test', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-2', 'Test2', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-3', 'Test3', 'git', NOW(), NOW())`);
  await upsertRoute({
    hostname: 'app.localhost:80',
    routeFile: 'app.caddy',
    port: 3000,
    targetContainers: ['deploy-dep-1'],
    deploymentId: 'dep-1',
    projectId: 'proj-1',
    serverId: null,
    status: 'pending',
  });
  await updateRouteStatus('app.localhost:80', 'active');
  const active = await getRouteByHostname('app.localhost:80');

  await truncate();
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-1', 'Test', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-2', 'Test2', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-3', 'Test3', 'git', NOW(), NOW())`);
  await upsertRoute({
    hostname: 'app.localhost:80',
    routeFile: 'app.caddy',
    port: 3000,
    targetContainers: ['deploy-dep-1'],
    deploymentId: 'dep-1',
    projectId: 'proj-1',
    serverId: null,
    status: 'pending',
  });
  await updateRouteStatus('app.localhost:80', 'active');
  const upsertActiveKept = await upsertRoute({
    hostname: 'app.localhost:80',
    routeFile: 'app.caddy',
    port: 3000,
    targetContainers: ['deploy-dep-1', 'deploy-dep-1-replica-2'],
    deploymentId: 'dep-1',
    projectId: 'proj-1',
    serverId: null,
    status: 'pending',
  });

  await truncate();
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-1', 'Test', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-2', 'Test2', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-3', 'Test3', 'git', NOW(), NOW())`);
  await upsertRoute({
    hostname: 'app.localhost:80',
    routeFile: 'app.caddy',
    port: 3000,
    targetContainers: ['deploy-dep-1'],
    deploymentId: 'dep-1',
    projectId: 'proj-1',
    serverId: null,
    status: 'pending',
  });
  await updateRouteStatus('app.localhost:80', 'failed', 'Caddy reload failed');
  const failed = await getRouteByHostname('app.localhost:80');

  await truncate();
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-1', 'Test', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-2', 'Test2', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-3', 'Test3', 'git', NOW(), NOW())`);
  await upsertRoute({
    hostname: 'other.localhost:80',
    routeFile: 'other.caddy',
    port: 8080,
    targetContainers: ['deploy-other-1'],
    deploymentId: 'dep-2',
    projectId: 'proj-2',
    serverId: 'server-1',
  });
  const filteredByServer = await listRoutes('server-1');

  await truncate();
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-1', 'Test', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-2', 'Test2', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-3', 'Test3', 'git', NOW(), NOW())`);
  await upsertRoute({
    hostname: 'app.localhost:80',
    routeFile: 'app.caddy',
    port: 3000,
    targetContainers: ['deploy-dep-1'],
    deploymentId: 'dep-1',
    projectId: 'proj-1',
    serverId: null,
    status: 'pending',
  });
  await upsertRoute({
    hostname: 'other.localhost:80',
    routeFile: 'other.caddy',
    port: 8080,
    targetContainers: ['deploy-other-1'],
    deploymentId: 'dep-2',
    projectId: 'proj-2',
    serverId: 'server-1',
  });
  await deleteRoutesByDeployment('dep-1');
  const afterDeleteByDeployment = (await listRoutes()).map((r: any) => r.deploymentId);
  const getDeleted = await getRouteByHostname('app.localhost:80');

  await truncate();
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-1', 'Test', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-2', 'Test2', 'git', NOW(), NOW())`);
  await pool.query(`INSERT INTO projects (id, name, source_type, created_at, updated_at) VALUES ('proj-3', 'Test3', 'git', NOW(), NOW())`);
  await upsertRoute({
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
  await upsertRoute({
    hostname: 'shared.localhost:80',
    routeFile: 'shared.caddy',
    port: 3000,
    targetContainers: ['deploy-dep-3'],
    deploymentId: 'dep-3',
    projectId: 'proj-3',
    serverId: 'server-2',
    status: 'active',
  });
  const separatePerServer = {
    serverIngress: await listRoutes('server-ingress'),
    server2: await listRoutes('server-2'),
  };

  console.log(JSON.stringify({
    upsert,
    listAfterUpsert,
    active,
    upsertActiveKept,
    failed,
    filteredByServer,
    afterDeleteByDeployment,
    getDeleted,
    separatePerServer,
  }));
} finally {
  await truncate();
  await pool.end();
}
