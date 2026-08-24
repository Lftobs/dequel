import { mkdir } from 'node:fs/promises';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { count, eq } from 'drizzle-orm';
import { apiRoutes } from './api';
import { migrate } from './db/migrate';
import { orchestrator } from './orchestrator';
import { config } from './utils/config';
import { getDb } from './db/db-provider';
import { deployments } from './db/schema';
import { scalingEngine } from './scaling/engine';
import { serverManager } from './servers/manager';
import { startDomainPolling } from './utils/domain-verifier';
import { alertEvaluator } from './monitoring/evaluator';
import { loadOrCreateJwtSecret } from './utils/secrets';
import { initAuth, cleanupExpiredTokens } from './utils/auth';
import { startBuildCleanup } from './orchestrator/cleanup';
import { startFailoverMonitor } from './orchestrator/failover';
import { startDatabaseMonitoring } from './databases/manager';
import { ensureLocalServer } from './db/repo';
import { startReconciliation, startStaleAgentCleanup, startAbandonedJobCleanup } from './orchestrator/reconciliation';

const bootstrap = async () => {
  await mkdir(config.workspaceRoot, { recursive: true });
  await mkdir(config.caddyRoutesDir, { recursive: true });

  const jwtSecret = await loadOrCreateJwtSecret('/app/data');
  initAuth(jwtSecret);

  await migrate();
  await ensureLocalServer();
  await orchestrator.reconcileState();
  orchestrator.startWorker();
  scalingEngine.start();
  serverManager.start();
  startDomainPolling();
  alertEvaluator.start();
  startBuildCleanup();
  startFailoverMonitor();
  startDatabaseMonitoring();
  startReconciliation();
  startStaleAgentCleanup();
  startAbandonedJobCleanup();
  setInterval(() => { cleanupExpiredTokens().catch(() => {}); }, 60_000);

  const metrics = {
    requestsTotal: 0,
    activeDeployments: 0,
    uptime: Date.now(),
  };

  const renderMetrics = async () => {
    const db = await getDb();
    const [result] = await db.select({ count: count() }).from(deployments).where(eq(deployments.status, 'running'));
    metrics.activeDeployments = Number(result?.count ?? 0);
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
