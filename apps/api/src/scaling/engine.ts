import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../utils/config';
import { dockerBin } from '../utils/docker-bin';
import { getScalingPolicy, listDeployments, updateDeploymentStatus } from '../db/repo';

const run = (cmd: string, args: string[]) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('close', (code) => {
      if (code === 0) resolve((stdout + '\n' + stderr).trim());
      else reject(new Error(`${cmd} ${args.join(' ')} failed (${code}): ${stderr}`));
    });
  });

const tryRun = (cmd: string, args: string[]) =>
  run(cmd, args).catch(() => '');

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

class ScalingEngine {
  private cooldowns = new Map<string, CooldownState>();
  private interval: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.interval) return;
    console.log('[Scaling] Engine started');
    this.interval = setInterval(() => this.tick(), 30_000);
  }

  stop() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
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

  private async evaluate(dep: { id: string; projectId: string | null; containerName: string | null }) {
    if (!dep.projectId || !dep.containerName) return;
    const policy = await getScalingPolicy(dep.projectId);
    if (!policy || !policy.enabled) return;

    const stats = await this.getContainerStats(dep.containerName);
    if (!stats) return;

    const state = this.getCooldownState(dep.id);
    const now = Date.now();

    // Scale up
    if (stats.cpuPercent > policy.cpuThresholdPercent) {
      if (state.highCpuSince === null) {
        state.highCpuSince = now;
      } else if (now - state.highCpuSince > policy.cooldownSeconds * 1000) {
        if (now - state.lastScaleUp > policy.cooldownSeconds * 1000) {
          await this.scaleUp(dep, policy.maxReplicas);
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
          await this.scaleDown(dep, policy.minReplicas);
          state.lastScaleDown = now;
          state.lowCpuSince = null;
        }
      }
    } else {
      state.lowCpuSince = null;
    }
  }

  private async getContainerStats(containerName: string): Promise<ContainerStats | null> {
    try {
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

  private parseMemToMb(mem: string): number {
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

  private getCooldownState(deploymentId: string): CooldownState {
    if (!this.cooldowns.has(deploymentId)) {
      this.cooldowns.set(deploymentId, {
        lastScaleUp: 0, lastScaleDown: 0,
        highCpuSince: null, lowCpuSince: null,
      });
    }
    return this.cooldowns.get(deploymentId)!;
  }

  private async getCurrentReplicas(slug: string): Promise<number> {
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
    dep: { id: string; projectId: string | null; containerName: string | null },
    maxReplicas: number,
  ) {
    const slug = dep.projectId || dep.id;
    const currentReplicas = await this.getCurrentReplicas(slug);
    if (currentReplicas >= maxReplicas) return;

    const newReplicaNum = currentReplicas + 1;
    const containerName = `deploy-${dep.id}-replica-${newReplicaNum}`;

    console.log(`[Scaling] Scaling up ${slug} -> ${newReplicaNum} replicas`);

    // Get the original container's image
    const imageTag = await run(dockerBin, ['inspect', '-f', '{{.Config.Image}}', dep.containerName!]).catch(() => '');
    if (!imageTag) return;

    // Get env vars from original
    const envJson = await run(dockerBin, ['inspect', '-f', '{{json .Config.Env}}', dep.containerName!]).catch(() => '[]');
    const envVars: string[] = [];
    try {
      const parsed = JSON.parse(envJson);
      for (const e of parsed) envVars.push('-e', e);
    } catch {}

    // Get volumes from original
    const mountsJson = await run(dockerBin, ['inspect', '-f', '{{json .Mounts}}', dep.containerName!]).catch(() => '[]');
    const volumes: string[] = [];
    try {
      const parsed = JSON.parse(mountsJson);
      for (const m of parsed) {
        if (m.Name) volumes.push('-v', `${m.Name}:${m.Destination}`);
      }
    } catch {}

    try {
      await run(dockerBin, [
        'run', '-d', '--name', containerName,
        '--network', config.dockerNetwork,
        ...volumes, ...envVars,
        imageTag,
      ]);
    } catch (err) {
      console.error(`[Scaling] Failed to create replica ${containerName}:`, err);
      return;
    }

    // Update Caddy route to include the new replica
    await this.updateCaddyRoute(slug, dep, newReplicaNum);
    console.log(`[Scaling] Replica ${containerName} started`);
  }

  private async scaleDown(
    dep: { id: string; projectId: string | null; containerName: string | null },
    minReplicas: number,
  ) {
    const slug = dep.projectId || dep.id;
    const currentReplicas = await this.getCurrentReplicas(slug);
    if (currentReplicas <= minReplicas) return;

    console.log(`[Scaling] Scaling down ${slug} -> ${currentReplicas - 1} replicas`);

    // Remove highest-numbered replica
    const replicaToRemove = `deploy-${dep.id}-replica-${currentReplicas}`;
    await tryRun(dockerBin, ['stop', '-t', '5', replicaToRemove]);
    await tryRun(dockerBin, ['rm', '-f', replicaToRemove]);

    await this.updateCaddyRoute(slug, dep, currentReplicas - 1);
    console.log(`[Scaling] Replica ${replicaToRemove} removed`);
  }

  private async updateCaddyRoute(
    slug: string,
    dep: { id: string; containerName: string | null },
    replicaCount: number,
  ) {
    const routeFile = join(config.caddyRoutesDir, `${slug}.caddy`);

    // Build proxy targets: primary + all replicas
    const targets = [`deploy-${dep.id}:${config.appInternalPort}`];
    for (let i = 2; i <= replicaCount; i++) {
      targets.push(`deploy-${dep.id}-replica-${i}:${config.appInternalPort}`);
    }

    const caddySnippet = `${slug}.localhost:80 {\n  reverse_proxy ${targets.join(' ')}\n}\n`;
    await writeFile(routeFile, caddySnippet, 'utf8');

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
