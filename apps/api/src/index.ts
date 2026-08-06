import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { apiRoutes } from './api';
import { migrate } from './db/migrate';
import { orchestrator } from './orchestrator';
import { config } from './utils/config';
import { getDb } from './db/client';
import { scalingEngine } from './scaling/engine';
import { serverManager } from './servers/manager';
import { startDomainPolling } from './utils/domain-verifier';
import { alertEvaluator } from './monitoring/evaluator';
import { loadOrCreateJwtSecret } from './utils/secrets';
import { initAuth, cleanupExpiredTokens } from './utils/auth';
import { startBuildCleanup } from './orchestrator/cleanup';
import { startDatabaseMonitoring } from './databases/manager';
import { leader } from './utils/leader';

let enginesStarted = false;
let shuttingDown = false;
let reconciled = false;

const startLeaderEngines = async () => {
  if (enginesStarted || !leader.isLeader) return;
  enginesStarted = true;
  if (!reconciled) {
    reconciled = true;
    await orchestrator.reconcileState().catch((error) =>
      console.error('[API] Reconcile failed', error),
    );
  }
  console.log('[API] Leadership acquired, starting background engines');
  scalingEngine.start();
  serverManager.start();
  startDomainPolling();
  alertEvaluator.start();
  startBuildCleanup();
  startDatabaseMonitoring();
  setInterval(() => {
    if (!leader.isLeader) return;
    cleanupExpiredTokens().catch(() => {});
  }, 60_000);
};

const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[API] ${signal} received, draining deployments and releasing leadership`);
  const force = setTimeout(() => process.exit(1), 180_000);
  force.unref();
  await Promise.allSettled([
    orchestrator.stopWorker(),
    leader.stop(),
  ]);
  console.log('[API] Drained, shutting down');
  clearTimeout(force);
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

const bootstrap = async () => {
  await mkdir(dirname(config.databasePath), { recursive: true });
  await mkdir(config.workspaceRoot, { recursive: true });
  await mkdir(config.caddyRoutesDir, { recursive: true });

  const jwtSecret = await loadOrCreateJwtSecret(dirname(config.databasePath));
  initAuth(jwtSecret);

  await migrate();
  await leader.start();
  void startLeaderEngines();
  setInterval(() => void startLeaderEngines(), 2_000);
  orchestrator.startWorker();

  const metrics = {
    requestsTotal: 0,
    activeDeployments: 0,
    uptime: Date.now(),
  };

  const renderMetrics = async () => {
    const db = await getDb();
    const depCount = db.query('SELECT COUNT(*) as count FROM deployments WHERE status = ?').get('running') as any;
    metrics.activeDeployments = depCount?.count ?? 0;
    const uptimeSec = Math.floor((Date.now() - metrics.uptime) / 1000);
    return `# HELP dequel_requests_total Total API requests
# TYPE dequel_requests_total counter
dequel_requests_total ${metrics.requestsTotal}
# HELP dequel_active_deployments Currently running deployments
# TYPE dequel_active_deployments gauge
dequel_active_deployments ${metrics.activeDeployments}
# HELP dequel_uptime_seconds API uptime in seconds
# TYPE dequel_uptime_seconds counter
dequel_uptime_seconds ${uptimeSec}
`;
  };

  const app = new Elysia()
    .use(cors())
    .onBeforeHandle(() => { metrics.requestsTotal++; })
    .use(apiRoutes)
    .get('/', () => ({ service: 'dequel-api', ok: true }))
    .get('/metrics', renderMetrics)
    .get('/api/metrics', renderMetrics);

  app.listen(config.port);
  console.log(`API listening on :${config.port}`);
};

bootstrap().catch((error) => {
  console.error('Bootstrap failed', error);
  process.exit(1);
});
