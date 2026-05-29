import { spawn } from 'node:child_process';
import { listServers, updateServerStatus, getServerById } from '../db/repo';

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
      const servers = await listServers();
      for (const server of servers) {
        await this.checkServer(server);
      }
    } catch (err) {
      console.error('[Servers] Heartbeat error:', err);
    }
  }

  private async checkServer(server: { id: string; host: string; port: number; authToken: string }) {
    try {
      // Use Docker API via CLI with -H flag to check remote server
      const info = await tryRun('docker', [
        '-H', `tcp://${server.host}:${server.port}`,
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

      // Try to get container stats for resource usage
      const stats = await tryRun('docker', [
        '-H', `tcp://${server.host}:${server.port}`,
        'stats', '--no-stream', '--format', '{{json .}}',
      ]);

      await updateServerStatus(server.id, 'connected', resources);
    } catch {
      await updateServerStatus(server.id, 'disconnected');
    }
  }
}

export const serverManager = new ServerManager();
