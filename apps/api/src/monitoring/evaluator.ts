import Redis from 'ioredis';
import { config } from '../utils/config';
import { getDb } from '../db/client';
import { listDeployments, getProjectById } from '../db/repo';
import { sendNotification } from './notifier';
import { dockerBin } from '../utils/docker-bin';
import { run } from '../orchestrator/runtime';

const NOTIFICATION_KEY = 'dequel:alert:notified';
const NOTIFICATION_COOLDOWN_MS = 300_000; // 5 min between same alert

interface ContainerStats {
  cpuPercent: number;
  memoryMb: number;
}

const getContainerStats = async (containerName: string): Promise<ContainerStats | null> => {
  try {
    const statsJson = await run(dockerBin, ['stats', '--no-stream', '--format', '{{json .}}', containerName]);
    const stats = JSON.parse(statsJson);
    const cpuPercent = parseFloat(stats.CPUPerc?.replace('%', '') ?? '0');
    const memStr = stats.MemUsage?.split('/')[0]?.trim() ?? '0B';
    const match = memStr.match(/^([\d.]+)(\w+)$/);
    let memoryMb = 0;
    if (match) {
      const val = parseFloat(match[1]);
      switch (match[2]) {
        case 'GiB': case 'GB': memoryMb = val * 1024; break;
        case 'MiB': case 'MB': memoryMb = val; break;
        case 'KiB': case 'KB': memoryMb = val / 1024; break;
      }
    }
    return { cpuPercent, memoryMb };
  } catch {
    return null;
  }
};

const getMetricValue = async (alertType: string, projectId: string, containerNames: string[]): Promise<number> => {
  if (alertType === 'cpu' || alertType === 'memory') {
    let total = 0;
    let count = 0;
    for (const name of containerNames) {
      const stats = await getContainerStats(name);
      if (stats) {
        total += alertType === 'cpu' ? stats.cpuPercent : stats.memoryMb;
        count++;
      }
    }
    return count > 0 ? total / count : 0;
  }
  if (alertType === 'downtime') {
    const deployments = await listDeployments(projectId);
    const running = deployments.filter(d => d.status === 'running');
    return running.length === 0 ? 1 : 0;
  }
  if (alertType === 'error_rate') {
    const deployments = await listDeployments(projectId);
    const failed = deployments.filter(d => d.status === 'failed');
    return failed.length > 0 ? failed.length : 0;
  }
  return 0;
};

class AlertEvaluator {
  private redis: Redis;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false });
  }

  start() {
    if (this.interval) return;
    console.log('[Alerts] Evaluator started');
    this.tick();
    this.interval = setInterval(() => this.tick(), config.alertEvalIntervalMs);
  }

  stop() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    this.redis.quit().catch(() => {});
  }

  private async tick() {
    try {
      const db = await getDb();
      const alertRows = db.query('SELECT * FROM alerts WHERE enabled = 1').all() as any[];
      if (!alertRows.length) return;

      const byProject = new Map<string, any[]>();
      for (const row of alertRows) {
        const arr = byProject.get(row.project_id) || [];
        arr.push(row);
        byProject.set(row.project_id, arr);
      }

      for (const [projectId, alerts] of byProject) {
        const project = await getProjectById(projectId);
        if (!project) continue;

        const deployments = await listDeployments(projectId);
        const containerNames = deployments.filter(d => d.containerName && d.status === 'running').map(d => d.containerName!);

        for (const alert of alerts) {
          try {
            await this.evaluate(alert, project, containerNames);
          } catch (err) {
            console.error(`[Alerts] Evaluate error for alert ${alert.id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[Alerts] Tick error:', err);
    }
  }

  private async evaluate(alert: any, project: { id: string; name: string }, containerNames: string[]) {
    const currentValue = await getMetricValue(alert.type, project.id, containerNames);
    if (currentValue === 0) return;

    const threshold = alert.threshold ?? (alert.type === 'memory' ? 85 : 70);
    let breached = false;

    switch (alert.type) {
      case 'cpu':
        breached = currentValue > threshold;
        break;
      case 'memory':
        breached = currentValue > threshold;
        break;
      case 'downtime':
        breached = currentValue > 0;
        break;
      case 'error_rate':
        breached = currentValue > 0;
        break;
      case 'cert_expiry':
        break;
    }

    if (!breached) return;

    const notifiedKey = `${NOTIFICATION_KEY}:${alert.id}`;
    const lastNotified = await this.redis.get(notifiedKey).then(v => v ? Number(v) : 0).catch(() => 0);
    if (Date.now() - lastNotified < NOTIFICATION_COOLDOWN_MS) return;

    await sendNotification({
      channel: alert.channel,
      destination: alert.destination,
      projectName: project.name,
      alertType: alert.type,
      threshold,
      currentValue,
    });

    await this.redis.set(notifiedKey, String(Date.now())).catch(() => {});
  }
}

export const alertEvaluator = new AlertEvaluator();
