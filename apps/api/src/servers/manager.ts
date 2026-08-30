import { spawn } from 'node:child_process';
import { listServerConnections, updateServerStatus } from '../db/repo';

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

class ServerManager {
  private interval: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.interval) return;
    console.log('[Servers] Health check engine started');
    this.interval = setInterval(() => this.heartbeat(), 30_000);
  }

  stop() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  }

  private async heartbeat() {
    try {
      const servers = await listServerConnections();
      for (const server of servers) {
        if (server.mode === 'agent') continue; // Handled via WebSocket heartbeats
        await this.checkServer(server);
      }
    } catch (err) {
      console.error('[Servers] Heartbeat error:', err);
    }
  }

  private async checkServer(server: { id: string; host: string; port: number; mode: string; sshUser?: string | null }) {
    try {
      let dockerTarget = `unix:///var/run/docker.sock`;
      if (server.mode === 'ssh') dockerTarget = `ssh://${server.sshUser || 'root'}@${server.host}:${server.port || 22}`;

      const info = await tryRun('docker', [
        '-H', dockerTarget,
        'info',
        '--format', '{{json .}}',
      ]);
      if (!info) {
        await updateServerStatus(server.id, 'disconnected');
        return;
      }

      const parsed = JSON.parse(info);
      const resources = {
        cpuTotal: parsed.NCPU ?? null,
        memoryTotalMb: parsed.MemTotal ? Math.floor(parsed.MemTotal / 1024 / 1024) : null,
        cpuUsedPercent: null,
        memoryUsedMb: null,
      };

      await updateServerStatus(server.id, 'connected', resources);
    } catch {
      await updateServerStatus(server.id, 'disconnected');
    }
  }
}

export const serverManager = new ServerManager();
