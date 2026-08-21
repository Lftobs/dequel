import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Redis from 'ioredis';
import { config } from '../utils/config';
import { dockerBin } from '../utils/docker-bin';
import { DEQUEL_MANAGED_LABEL } from '../utils/dequel-labels';
import { run, tryRun } from './docker-utils';
import { execDockerSshCommand, syncRemoteCaddyRoute } from '../utils/ssh';
import { getScalingPolicy, listDeployments, updateDeploymentStatus, listEnvironmentVariablesForDeploy, getProjectById } from '../db/repo';
import type { Server } from '../types';

interface ContainerStats {
  containerName: string;
  cpuPercent: number;
  memoryMb: number;
}

interface CooldownState {
  lastScaleUp: number;
  lastScaleDown: number;
  highCpuSince: number | null;
  lowCpuSince: number | null;
}

interface Target {
  server: Server | null;
  mode: string;
}

const AGENT_OFFLINE_MS = 90_000;

class ScalingEngine {
  private redis: Redis;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false });
  }

  start() {
    if (this.interval) return;
    console.log('[Scaling] Engine started');
    this.tick();
    this.interval = setInterval(() => this.tick(), 30_000);
  }

  stop() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    this.redis.quit().catch(() => {});
  }

  private async tick() {
    try {
      const deployments = await listDeployments();
      const running = deployments.filter(d => d.status === 'running' && d.projectId);
      for (const dep of running) {
        await this.evaluate(dep);
      }
    } catch (err) {
      console.error('[Scaling] Tick error:', err);
    }
  }

  private async resolveTarget(dep: { serverId?: string | null }): Promise<Target> {
    if (!dep.serverId || dep.serverId === 'local') return { server: null, mode: 'local' };
    const { getServerById } = await import('../db/repo');
    const server = await getServerById(dep.serverId).catch(() => null);
    return { server, mode: server?.mode ?? 'local' };
  }

  private isAgentOffline(server: Server | null): boolean {
    if (!server?.lastHeartbeat) return true;
    return Date.now() - new Date(server.lastHeartbeat).getTime() > AGENT_OFFLINE_MS;
  }

  private async evaluate(dep: { id: string; projectId: string | null; containerName: string | null; serverId?: string | null }) {
    if (!dep.projectId || !dep.containerName) return;
    const policy = await getScalingPolicy(dep.projectId);
    if (!policy || !policy.enabled) return;

    const project = await getProjectById(dep.projectId);
    if (!project || !project.cpuLimit || project.cpuLimit <= 0) return;

    const target = await this.resolveTarget(dep);
    if (target.mode === 'agent' && this.isAgentOffline(target.server)) return;

    const stats = await this.getContainerStats(dep.containerName, target);
    if (!stats) return;
    const slug = project ? project.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63) : dep.projectId;

    const state = await this.getCooldownState(dep.id);
    const now = Date.now();

    // Scale up
    if (stats.cpuPercent > policy.cpuThresholdPercent) {
      if (state.highCpuSince === null) {
        state.highCpuSince = now;
      } else if (now - state.highCpuSince > policy.cooldownSeconds * 1000) {
        if (now - state.lastScaleUp > policy.cooldownSeconds * 1000) {
          await this.scaleUp(dep, policy.maxReplicas, slug, target, project?.cpuLimit, project?.memoryLimitMb);
          state.lastScaleUp = now;
          state.highCpuSince = null;
        }
      }
      state.lowCpuSince = null;
    } else {
      state.highCpuSince = null;
    }

    // Scale down
    if (stats.cpuPercent < 30) {
      if (state.lowCpuSince === null) {
        state.lowCpuSince = now;
      } else if (now - state.lowCpuSince > 300_000) { // 5 min
        if (now - state.lastScaleDown > policy.cooldownSeconds * 1000) {
          await this.scaleDown(dep, policy.minReplicas, slug, target);
          state.lastScaleDown = now;
          state.lowCpuSince = null;
        }
      }
    } else {
      state.lowCpuSince = null;
    }

    await this.saveCooldownState(dep.id, state);
  }

  private async getContainerStats(containerName: string, target: Target): Promise<ContainerStats | null> {
    try {
      if (target.mode === 'agent') {
        const { agentStatsCache } = await import('../agents/stats-cache');
        const containers = await agentStatsCache.get(target.server!.id);
        const stat = containers.get(containerName);
        if (!stat) return null;
        return { containerName, cpuPercent: stat.cpuPercent, memoryMb: stat.memoryMb };
      }
      if (target.mode === 'ssh') {
        const result = await execDockerSshCommand(target.server!, ['stats', '--no-stream', '--format', '{{json .}}', containerName]);
        if (result.code !== 0) return null;
        const stats = JSON.parse(result.stdout);
        return { containerName, cpuPercent: parseFloat(stats.CPUPerc?.replace('%', '') ?? '0'), memoryMb: this.parseMemToMb(stats.MemUsage?.split('/')[0]?.trim() ?? '0B') };
      }
      const statsJson = await run(dockerBin, ['stats', '--no-stream', '--format', '{{json .}}', containerName]);
      const stats = JSON.parse(statsJson);
      const cpuPercent = parseFloat(stats.CPUPerc?.replace('%', '') ?? '0');
      const memStr = stats.MemUsage?.split('/')[0]?.trim() ?? '0B';
      const memoryMb = this.parseMemToMb(memStr);
      return { containerName, cpuPercent, memoryMb };
    } catch {
      return null;
    }
  }

  parseMemToMb(mem: string): number {
    const match = mem.match(/^([\d.]+)(\w+)$/);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    switch (match[2]) {
      case 'GiB': case 'GB': return val * 1024;
      case 'MiB': case 'MB': return val;
      case 'KiB': case 'KB': return val / 1024;
      default: return val;
    }
  }

  private cooldownKey(deploymentId: string) { return `dequel:scaling:cooldown:${deploymentId}`; }

  private async getCooldownState(deploymentId: string): Promise<CooldownState> {
    const key = this.cooldownKey(deploymentId);
    const raw = await this.redis.hgetall(key).catch(() => ({} as Record<string, string>));
    return {
      lastScaleUp: Number(raw.lastScaleUp) || 0,
      lastScaleDown: Number(raw.lastScaleDown) || 0,
      highCpuSince: raw.highCpuSince ? Number(raw.highCpuSince) || null : null,
      lowCpuSince: raw.lowCpuSince ? Number(raw.lowCpuSince) || null : null,
    };
  }

  private async saveCooldownState(deploymentId: string, state: CooldownState) {
    const key = this.cooldownKey(deploymentId);
    await this.redis.hset(key, {
      lastScaleUp: String(state.lastScaleUp),
      lastScaleDown: String(state.lastScaleDown),
      highCpuSince: state.highCpuSince ? String(state.highCpuSince) : '',
      lowCpuSince: state.lowCpuSince ? String(state.lowCpuSince) : '',
    }).catch(() => {});
  }

  private async getCurrentReplicas(slug: string, target: Target = { server: null, mode: 'local' }, dep: { id: string; projectId: string | null; containerName: string | null } | null = null): Promise<number> {
    if (target.mode === 'agent' && dep) {
      const { agentStatsCache } = await import('../agents/stats-cache');
      const containers = await agentStatsCache.get(target.server!.id);
      let count = 0;
      for (const stat of containers.values()) {
        if (stat.replica && stat.projectId && dep.projectId && stat.projectId === dep.projectId) count++;
      }
      if (containers.has(dep.containerName ?? '')) count++;
      return Math.max(1, count);
    }
    if (target.mode === 'ssh') {
      const result = await execDockerSshCommand(target.server!, ['ps', '-q', '--filter', 'label=com.dequel.replica=1']);
      const count = result.stdout.split('\n').map(l => l.trim()).filter(Boolean).length;
      return Math.max(1, count + 1);
    }
    const routeFile = join(config.caddyRoutesDir, `${slug}.caddy`);
    try {
      const content = await readFile(routeFile, 'utf8');
      const matches = content.match(/reverse_proxy\s+([^\n]+)/g);
      if (!matches) return 1;
      // Count unique container names
      const containers = new Set<string>();
      for (const m of matches) {
        const parts = m.replace('reverse_proxy', '').trim().split(/\s+/);
        for (const p of parts) containers.add(p.split(':')[0]);
      }
      return Math.max(1, containers.size);
    } catch {
      return 1;
    }
  }

  private async scaleUp(
    dep: { id: string; projectId: string | null; containerName: string | null; serverId?: string | null },
    maxReplicas: number,
    slug: string,
    target: Target,
    cpuLimit?: number | null,
    memoryLimitMb?: number | null,
  ) {
    const currentReplicas = await this.getCurrentReplicas(slug, target, dep);
    if (currentReplicas >= maxReplicas) return;

    const newReplicaNum = currentReplicas + 1;
    const containerName = `deploy-${dep.id}-replica-${newReplicaNum}`;

    console.log(`[Scaling] Scaling up ${slug} -> ${newReplicaNum} replicas (${target.mode})`);

    if (target.mode === 'agent') {
      await this.enqueueScaleJob(dep, target.server!, 'up', newReplicaNum, slug);
      return;
    }

    // Get the original container's image
    const imageTag = target.mode === 'ssh'
      ? dep.imageTag ?? (await execDockerSshCommand(target.server!, ['inspect', '-f', '{{.Config.Image}}', dep.containerName!])).stdout.trim()
      : await run(dockerBin, ['inspect', '-f', '{{.Config.Image}}', dep.containerName!]).catch(() => '');
    if (!imageTag) return;

    // Get env vars from original
    const envJson = target.mode === 'ssh'
      ? (await execDockerSshCommand(target.server!, ['inspect', '-f', '{{json .Config.Env}}', dep.containerName!])).stdout
      : await run(dockerBin, ['inspect', '-f', '{{json .Config.Env}}', dep.containerName!]).catch(() => '[]');
    const envVars: string[] = [];
    try {
      const parsed = JSON.parse(envJson);
      for (const e of parsed) envVars.push('-e', e);
    } catch {}

    // Get volumes from original
    const mountsJson = target.mode === 'ssh'
      ? (await execDockerSshCommand(target.server!, ['inspect', '-f', '{{json .Mounts}}', dep.containerName!])).stdout
      : await run(dockerBin, ['inspect', '-f', '{{json .Mounts}}', dep.containerName!]).catch(() => '[]');
    const volumes: string[] = [];
    try {
      const parsed = JSON.parse(mountsJson);
      for (const m of parsed) {
        if (m.Name) volumes.push('-v', `${m.Name}:${m.Destination}`);
      }
    } catch {}

    const resources: string[] = [];
    if (cpuLimit && cpuLimit > 0) {
      resources.push('--cpus', String(cpuLimit));
    }
    if (memoryLimitMb && memoryLimitMb > 0) {
      resources.push('--memory', `${Math.round(memoryLimitMb)}m`);
    }

    const replicaArgs = [
      'run', '-d', '--name', containerName,
      '--network', config.dockerNetwork,
      '-l', DEQUEL_MANAGED_LABEL,
      '-l', 'com.dequel.replica=1',
      ...resources,
      ...volumes, ...envVars,
      imageTag,
    ];

    try {
      if (target.mode === 'ssh') {
        const result = await execDockerSshCommand(target.server!, replicaArgs);
        if (result.code !== 0) throw new Error(result.stderr);
      } else {
        await run(dockerBin, replicaArgs);
      }
    } catch (err) {
      console.error(`[Scaling] Failed to create replica ${containerName}:`, err);
      return;
    }

    // Update Caddy route to include the new replica
    await this.updateCaddyRoute(slug, dep, newReplicaNum, target);
    console.log(`[Scaling] Replica ${containerName} started`);
  }

  private async scaleDown(
    dep: { id: string; projectId: string | null; containerName: string | null; serverId?: string | null },
    minReplicas: number,
    slug: string,
    target: Target,
  ) {
    const currentReplicas = await this.getCurrentReplicas(slug, target, dep);
    if (currentReplicas <= minReplicas) return;

    console.log(`[Scaling] Scaling down ${slug} -> ${currentReplicas - 1} replicas (${target.mode})`);

    // Remove highest-numbered replica
    const replicaToRemove = `deploy-${dep.id}-replica-${currentReplicas}`;

    if (target.mode === 'agent') {
      await this.enqueueScaleJob(dep, target.server!, 'down', currentReplicas, slug);
      return;
    }

    if (target.mode === 'ssh') {
      await execDockerSshCommand(target.server!, ['rm', '-f', replicaToRemove]).catch(() => {});
    } else {
      await tryRun(dockerBin, ['rm', '-f', replicaToRemove]);
    }

    await this.updateCaddyRoute(slug, dep, currentReplicas - 1, target);
    console.log(`[Scaling] Replica ${replicaToRemove} removed`);
  }

  private async enqueueScaleJob(
    dep: { id: string; projectId: string | null; containerName: string | null; imageTag?: string | null },
    server: Server,
    action: 'up' | 'down',
    replicas: number,
    slug: string,
  ) {
    const { createAgentJob, upsertRoute } = await import('../db/repo');
    const project = dep.projectId ? await getProjectById(dep.projectId) : null;
    const envVars = dep.projectId ? await listEnvironmentVariablesForDeploy(dep.projectId) : [];
    const payload = {
      deploymentId: dep.id,
      projectId: dep.projectId,
      action,
      replicas,
      imageTag: dep.imageTag ?? `${slug}-${dep.id.slice(0, 8)}:latest`,
      appPort: project?.port || 3000,
      cpuLimit: project?.cpuLimit ?? null,
      memoryLimitMb: project?.memoryLimitMb ?? null,
      environmentVariables: envVars,
    };
    await createAgentJob({
      deploymentId: dep.id,
      serverId: server.id,
      type: 'scale',
      payload,
      idempotencyKey: `scale:${dep.id}:${action}:${replicas}`,
    });
    const { baseDomainFor } = await import('../utils/routes');
    const hostname = `${slug}.${baseDomainFor()}`;
    const routeFile = `${slug}.caddy`;
    const appPort = project?.port || 3000;
    const targets = [`deploy-${dep.id}`];
    for (let i = 2; i <= replicas; i++) targets.push(`deploy-${dep.id}-replica-${i}`);
    await upsertRoute({
      serverId: server.id,
      deploymentId: dep.id,
      projectId: dep.projectId,
      hostname,
      routeFile,
      port: appPort,
      targetContainers: targets,
      status: 'pending',
    });
    await createAgentJob({
      deploymentId: dep.id,
      serverId: server.id,
      type: 'reload_routes',
      payload: {
        deploymentId: dep.id,
        action: 'add',
        hostname,
        routeFile,
        port: appPort,
        targetContainers: targets,
      },
      idempotencyKey: `route:scale:${dep.id}:${action}:${replicas}`,
    });
    console.log(`[Scaling] Scale ${action} job queued for server ${server.id.slice(0, 8)}`);
  }

  private async updateCaddyRoute(
    slug: string,
    dep: { id: string; projectId: string | null; containerName: string | null },
    replicaCount: number,
    target: Target,
  ) {
    let port = config.appInternalPort;

    if (dep.projectId) {
      try {
        const envVars = await listEnvironmentVariablesForDeploy(dep.projectId);
        const portVar = envVars.find(v => v.key === 'PORT');
        if (portVar && portVar.value) {
          const parsedPort = Number(portVar.value);
          if (!isNaN(parsedPort) && parsedPort > 0) {
            port = parsedPort;
          }
        }
      } catch (err) {
        console.warn(`[Scaling] Could not read env vars for project ${dep.projectId}:`, err);
      }
    }

    // Build proxy targets: primary + all replicas
    const targets = [`deploy-${dep.id}:${port}`];
    for (let i = 2; i <= replicaCount; i++) {
      targets.push(`deploy-${dep.id}-replica-${i}:${port}`);
    }

    const baseDomain = config.caddyBaseDomain === 'localhost' ? `${config.caddyBaseDomain}:80` : config.caddyBaseDomain;
    const { getIngressServer, shouldRouteViaIngress, projectServerSite, syncIngressRoute, upsertIngressRoute } = await import('../utils/ingress');
    const ingressServer = await getIngressServer();
    const viaIngress = shouldRouteViaIngress(target.server ?? null, ingressServer);
    const caddySnippet = viaIngress
      ? projectServerSite(`${slug}.${baseDomain}`, port, targets.map((t) => t.split(':')[0]), true)
      : `${slug}.${baseDomain} {\n  reverse_proxy ${targets.join(' ')} {\n    header_up Host {upstream_hostport}\n  }\n}\n`;

    if (target.mode === 'ssh') {
      await syncRemoteCaddyRoute(target.server!, `${slug}.caddy`, caddySnippet);
      const { upsertRoute } = await import('../db/repo');
      const { baseDomainFor } = await import('../utils/routes');
      await upsertRoute({
        serverId: target.server!.id,
        deploymentId: dep.id,
        projectId: dep.projectId,
        hostname: `${slug}.${baseDomainFor()}`,
        routeFile: `${slug}.caddy`,
        port,
        targetContainers: targets.map((t) => t.split(':')[0]),
        status: 'active',
      });
      if (viaIngress && ingressServer && target.server) {
        await syncIngressRoute(ingressServer, target.server.host, {
          hostname: `${slug}.${baseDomainFor()}`,
          routeFile: `${slug}.caddy`,
          port,
          containers: targets.map((t) => t.split(':')[0]),
        });
        await upsertIngressRoute(ingressServer.id, dep.projectId, dep.id, target.server.host, {
          hostname: `${slug}.${baseDomainFor()}`,
          routeFile: `${slug}.caddy`,
          port,
          containers: targets.map((t) => t.split(':')[0]),
        });
      }
      return;
    }

    await writeFile(join(config.caddyRoutesDir, `${slug}.caddy`), caddySnippet, 'utf8');
    const { upsertRoute } = await import('../db/repo');
    const { baseDomainFor } = await import('../utils/routes');
    await upsertRoute({
      serverId: 'local',
      deploymentId: dep.id,
      projectId: dep.projectId,
      hostname: `${slug}.${baseDomainFor()}`,
      routeFile: `${slug}.caddy`,
      port,
      targetContainers: targets.map((t) => t.split(':')[0]),
      status: 'active',
    });
    if (viaIngress && ingressServer && target.server) {
      await syncIngressRoute(ingressServer, target.server.host, {
        hostname: `${slug}.${baseDomainFor()}`,
        routeFile: `${slug}.caddy`,
        port,
        containers: targets.map((t) => t.split(':')[0]),
      });
      await upsertIngressRoute(ingressServer.id, dep.projectId, dep.id, target.server.host, {
        hostname: `${slug}.${baseDomainFor()}`,
        routeFile: `${slug}.caddy`,
        port,
        containers: targets.map((t) => t.split(':')[0]),
      });
    }

    // Reload Caddy
    try {
      const caddyContainer = await run(dockerBin, [
        'ps', '-q',
        '--filter', 'label=com.docker.compose.service=caddy',
        '--filter', `network=${config.dockerNetwork}`,
      ]);
      const caddyId = caddyContainer.split('\n').map(l => l.trim()).find(Boolean);
      if (caddyId) {
        await run(dockerBin, ['exec', caddyId, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile']);
      }
    } catch {}
  }
}

export const scalingEngine = new ScalingEngine();