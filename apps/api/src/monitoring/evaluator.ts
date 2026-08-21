import Redis from 'ioredis';
import { config } from '../utils/config';
import { getDb } from '../db/client';
import { listDeployments, getProjectById, getServerById } from '../db/repo';
import { sendNotification } from './notifier';
import { dockerBin } from '../utils/docker-bin';
import { run } from '../orchestrator/runtime';
import type { Deployment, Server } from '../types';

const NOTIFICATION_KEY = 'dequel:alert:notified';
const NOTIFICATION_COOLDOWN_MS = 300_000; // 5 min between same alert
const AGENT_OFFLINE_MS = 90_000;

interface ContainerStats {
  cpuPercent: number;
  memoryMb: number;
}

const parseMemToMb = (mem: string): number => {
  const match = mem.match(/^([\d.]+)(\w+)$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  switch (match[2]) {
    case 'GiB': case 'GB': return val * 1024;
    case 'MiB': case 'MB': return val;
    case 'KiB': case 'KB': return val / 1024;
    default: return val;
  }
};

const parseStatsJson = (statsJson: string): ContainerStats | null => {
  try {
    const stats = JSON.parse(statsJson);
    return {
      cpuPercent: parseFloat(stats.CPUPerc?.replace('%', '') ?? '0'),
      memoryMb: parseMemToMb(stats.MemUsage?.split('/')[0]?.trim() ?? '0B'),
    };
  } catch {
    return null;
  }
};

const isAgentOffline = (server: Server | null): boolean => {
  if (!server?.lastHeartbeat) return true;
  return Date.now() - new Date(server.lastHeartbeat).getTime() > AGENT_OFFLINE_MS;
};

const getContainerStats = async (deployment: Deployment): Promise<ContainerStats | null> => {
  const server = deployment.serverId && deployment.serverId !== 'local'
    ? await getServerById(deployment.serverId).catch(() => null)
    : null;
  const mode = server?.mode ?? 'local';
  if (mode === 'agent') {
    if (isAgentOffline(server)) return null;
    const { agentStatsCache } = await import('../agents/stats-cache');
    const containers = await agentStatsCache.get(server!.id);
    const stat = containers.get(deployment.containerName ?? '');
    return stat ? { cpuPercent: stat.cpuPercent, memoryMb: stat.memoryMb } : null;
  }
  try {
    const statsJson = await run(dockerBin, ['stats', '--no-stream', '--format', '{{json .}}', deployment.containerName ?? ''], server);
    return parseStatsJson(statsJson);
  } catch {
    return null;
  }
};

const getMetricValue = async (alertType: string, projectId: string, deployments: Deployment[]): Promise<number> => {
  if (alertType === 'cpu' || alertType === 'memory') {
    let total = 0;
    let count = 0;
    for (const dep of deployments) {
      if (dep.status !== 'running' || !dep.containerName) continue;
      const stats = await getContainerStats(dep);
      if (stats) {
        total += alertType === 'cpu' ? stats.cpuPercent : stats.memoryMb;
        count++;
      }
    }
    return count > 0 ? total / count : 0;
  }
  if (alertType === 'downtime') {
    const running = deployments.filter(d => d.status === 'running');
    return running.length === 0 ? 1 : 0;
  }
  if (alertType === 'error_rate') {
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

        for (const alert of alerts) {
          try {
            await this.evaluate(alert, project, deployments);
          } catch (err) {
            console.error(`[Alerts] Evaluate error for alert ${alert.id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[Alerts] Tick error:', err);
    }
  }

  private async evaluate(alert: any, project: { id: string; name: string }, deployments: Deployment[]) {
    const currentValue = await getMetricValue(alert.type, project.id, deployments);
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
