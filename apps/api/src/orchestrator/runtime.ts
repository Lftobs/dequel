import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { config } from '../utils/config';
import { dockerBin } from '../utils/docker-bin';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);

export interface RuntimeOpts {
  projectId?: string;
  projectName?: string;
  oldContainerName?: string;
  envVars?: Record<string, string>;
  volumes?: { hostPath?: string; volumeName?: string; mountPath: string }[];
  replicas?: number;
  cpuLimit?: number | null;
  memoryLimitMb?: number | null;
  appPort?: number;
}

export const run = (cmd: string, args: string[]) =>
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

const getCaddyContainer = async (): Promise<string> => {
  const output = await run(dockerBin, [
    'ps', '-q',
    '--filter', 'label=com.docker.compose.service=caddy',
    '--filter', `network=${config.dockerNetwork}`,
  ]);
  const containerId = output.split('\n').map(l => l.trim()).find(Boolean);
  if (!containerId) throw new Error('Could not find running Caddy container');
  return containerId;
};

export const tryRun = async (cmd: string, args: string[]) => {
  try { await run(cmd, args); } catch { return; }
};

const waitForRunningContainer = async (
  containerName: string,
  retries: number,
  onLog: (line: string) => Promise<void>,
) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const status = (await run(dockerBin, ['inspect', '-f', '{{.State.Status}}', containerName])).trim();
      if (status === 'running') {
        await new Promise(r => setTimeout(r, 2000));
        const stabilityStatus = (await run(dockerBin, ['inspect', '-f', '{{.State.Status}}', containerName])).trim();
        if (stabilityStatus !== 'running') {
          const logs = await run(dockerBin, ['logs', '--tail', '50', containerName]).catch(() => 'no logs available');
          throw new Error(`Container crashed shortly after starting. Logs:\n${logs}`);
        }
        return;
      }
      if (status === 'exited') {
        let logs = await run(dockerBin, ['logs', '--tail', '50', containerName]).catch(() => 'no logs available');
        logs = logs.trim() || '*No logs produced*';
        throw new Error(`Container ${containerName} exited immediately. Logs:\n${logs}`);
      }
      if (status === 'created') await onLog(`Container ${containerName} still initializing...`);
    } catch (e: any) {
      if (e.message?.includes('exited immediately') || e.message?.includes('crashed shortly')) throw e;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  await onLog(`Container ${containerName} did not reach running state — attempting docker start`);
  await tryRun(dockerBin, ['start', containerName]);
  await tryRun(dockerBin, ['network', 'connect', config.dockerNetwork, containerName]);
};

export const ensureContainerRunning = async (containerName: string) => {
  try {
    const status = (await run(dockerBin, ['inspect', '-f', '{{.State.Status}}', containerName])).trim();
    if (status !== 'running') await run(dockerBin, ['start', containerName]);
    await tryRun(dockerBin, ['network', 'connect', config.dockerNetwork, containerName]);
  } catch (error) {
    console.error(`Failed to reconcile container ${containerName}:`, error);
  }
};

export const reloadCaddy = async () => {
  const caddyContainer = await getCaddyContainer();
  await run(dockerBin, ['exec', caddyContainer, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile']);
};

export const deployContainer = async (
  deploymentId: string,
  imageTag: string,
  onLog: (line: string) => Promise<void>,
  opts: RuntimeOpts = {},
) => {
  const slug = slugify(opts.projectName || opts.projectId || deploymentId);
  const shortId = deploymentId.slice(0, 8);
  const containerName = `${slug}-${shortId}`;
  const scheme = config.caddyBaseDomain === 'localhost' ? 'http' : 'https';
  const liveUrl = `${scheme}://${slug}.${config.caddyBaseDomain}`;

  await onLog(`Starting container ${containerName} from image ${imageTag}`);

  const dockerArgs = [
    'run', '-d',
    '--name', containerName,
    '--network', config.dockerNetwork,
    '-e', `PORT=${opts.appPort ?? config.appInternalPort}`,
  ];

  if (opts.cpuLimit && opts.cpuLimit > 0) {
    dockerArgs.push('--cpus', String(opts.cpuLimit));
  }
  if (opts.memoryLimitMb && opts.memoryLimitMb > 0) {
    dockerArgs.push('--memory', `${Math.round(opts.memoryLimitMb)}m`);
  }

  // Add env vars
  if (opts.envVars) {
    for (const [key, value] of Object.entries(opts.envVars)) {
      dockerArgs.push('-e', `${key}=${value}`);
    }
  }

  // Add volume mounts
  if (opts.volumes) {
    for (const vol of opts.volumes) {
      // Check if the volume exists, create if not
      if (vol.volumeName) {
        await tryRun(dockerBin, ['volume', 'create', vol.volumeName]);
        dockerArgs.push('-v', `${vol.volumeName}:${vol.mountPath}`);
      } else if (vol.hostPath) {
        dockerArgs.push('-v', `${vol.hostPath}:${vol.mountPath}`);
      }
    }
  }
  // Default volume mount if project has a volume
  if (!opts.volumes?.length && opts.projectId) {
    const defaultVolume = `vol-${opts.projectId.slice(0, 12)}`;
    await tryRun(dockerBin, ['volume', 'create', defaultVolume]);
    dockerArgs.push('-v', `${defaultVolume}:/app/data`);
  }

  dockerArgs.push(imageTag);

  await run(dockerBin, dockerArgs);
  await onLog(`Waiting for container ${containerName} to report running`);
  await waitForRunningContainer(containerName, 40, onLog);
  await tryRun(dockerBin, ['network', 'connect', config.dockerNetwork, containerName]);

  const caddyRouteFile = join(config.caddyRoutesDir, `${slug}.caddy`);
  const { buildCaddySnippet } = await import('../utils/domain-verifier');
  const caddySnippet = await buildCaddySnippet(slug, containerName, opts.projectId, undefined, opts.appPort);

  await onLog(`Writing Caddy route file: ${caddyRouteFile}`);
  await writeFile(caddyRouteFile, caddySnippet, 'utf8');

  await onLog('Reloading Caddy to apply dynamic route');
  try { await reloadCaddy(); } catch (error) {
    await onLog(`Caddy reload failed (might not be ready): ${error instanceof Error ? error.message : String(error)}`);
  }
  await onLog('Caddy route reload completed');

  if (opts.oldContainerName && opts.oldContainerName !== containerName) {
    await onLog(`Gracefully stopping old container: ${opts.oldContainerName}`);
    await tryRun(dockerBin, ['stop', '-t', '10', opts.oldContainerName]);
    await tryRun(dockerBin, ['rm', '-f', opts.oldContainerName]);
    await onLog(`Old container ${opts.oldContainerName} removed`);
  }

  await onLog(`Deployment reachable at ${liveUrl}`);
  return { containerName, routePath: `/apps/${slug}`, liveUrl };
};
