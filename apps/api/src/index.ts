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
import { startGitWatcher } from './git/watcher';
import { startDomainPolling } from './utils/domain-verifier';
import { alertEvaluator } from './monitoring/evaluator';
const bootstrap = async () => {
  await mkdir(dirname(config.databasePath), { recursive: true });
  await mkdir(config.workspaceRoot, { recursive: true });
  await mkdir(config.caddyRoutesDir, { recursive: true });

  await migrate();
  await orchestrator.reconcileState();
  orchestrator.startWorker();
  scalingEngine.start();
  serverManager.start();
  startGitWatcher();
  startDomainPolling();
  alertEvaluator.start();

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
