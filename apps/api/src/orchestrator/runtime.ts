import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { config } from '../utils/config';
import { dockerBin } from '../utils/docker-bin';
import { DEQUEL_MANAGED_LABEL } from '../utils/dequel-labels';
import type { Server } from '../types';
import { getDockerSshTarget, syncRemoteCaddyRoute } from '../utils/ssh';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);

export interface RuntimeOpts {
  projectId?: string;
  projectName?: string;
  baseDomain?: string | null;
  oldContainerName?: string;
  envVars?: Record<string, string>;
  volumes?: { hostPath?: string; volumeName?: string; mountPath: string }[];
  replicas?: number;
  cpuLimit?: number | null;
  memoryLimitMb?: number | null;
  appPort?: number;
  targetServer?: Server | null;
}

const getDockerTargetArgs = (server?: Server | null): string[] => {
  if (server?.mode === 'ssh') {
    return ['-H', getDockerSshTarget(server)];
  }
  if (server?.mode === 'docker_tcp') {
    return ['-H', `tcp://${server.host}:${server.port || 2376}`];
  }
  return [];
};

export const run = (cmd: string, args: string[], server?: Server | null) =>
  new Promise<string>((resolve, reject) => {
    const targetArgs = getDockerTargetArgs(server);
    const fullArgs = cmd === dockerBin && targetArgs.length > 0 ? [...targetArgs, ...args] : args;
    const child = spawn(cmd, fullArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('close', (code) => {
      if (code === 0) resolve((stdout + '\n' + stderr).trim());
      else reject(new Error(`${cmd} ${fullArgs.join(' ')} failed (${code}): ${stderr}`));
    });
  });

const getCaddyContainer = async (): Promise<string> => {
  const output = await run(dockerBin, ['ps', '--filter', 'name=caddy', '--filter', 'label=com.docker.compose.service=caddy', '--format', '{{.Names}}']);
  const name = output.split('\n')[0]?.trim();
  if (!name) throw new Error('Caddy container not found');
  return name;
};

export const tryRun = async (cmd: string, args: string[], server?: Server | null) => {
  try { await run(cmd, args, server); } catch { return; }
};

const waitForRunningContainer = async (
  containerName: string,
  retries: number,
  onLog: (line: string) => Promise<void>,
) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
    const exists = await run(dockerBin, ['inspect', '-f', '{{.Id}}', containerName])
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      await new Promise(r => setTimeout(r, 500));
      continue;
    }
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
  await tryRun(dockerBin, ['network', 'disconnect', '-f', config.dockerNetwork, containerName]);
  await tryRun(dockerBin, ['start', containerName]);
  await tryRun(dockerBin, ['network', 'connect', config.dockerNetwork, containerName]);
};

export const ensureContainerRunning = async (containerName: string) => {
  try {
    const exists = await run(dockerBin, ['inspect', '-f', '{{.Id}}', containerName]).then(() => true).catch(() => false);
    if (!exists) {
      console.warn(`Container ${containerName} not found — skipping reconciliation`);
      return;
    }
    const status = (await run(dockerBin, ['inspect', '-f', '{{.State.Status}}', containerName])).trim();
    if (status !== 'running') {
      await tryRun(dockerBin, ['network', 'disconnect', '-f', config.dockerNetwork, containerName]);
      await run(dockerBin, ['start', containerName]);
    }
    await tryRun(dockerBin, ['network', 'connect', config.dockerNetwork, containerName]);
  } catch (error) {
    console.error(`Failed to reconcile container ${containerName}:`, error);
  }
};

export const reloadCaddy = async () => {
  if (process.env.NODE_ENV === 'test') return;
  const caddyContainer = await getCaddyContainer();
  await run(dockerBin, ['exec', caddyContainer, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile']);
};

export const getContainerName = (deploymentId: string, projectName?: string, projectId?: string) => {
  const slug = slugify(projectName || projectId || deploymentId);
  return `${slug}-${deploymentId.slice(0, 8)}`;
};

export const cleanupFailedDeployment = async (
  deploymentId: string,
  imageTag?: string | null,
  projectName?: string,
  projectId?: string,
  sourceType?: string | null,
) => {
  const containerName = getContainerName(deploymentId, projectName, projectId);
  await tryRun(dockerBin, ['network', 'disconnect', '-f', config.dockerNetwork, containerName]);
  await tryRun(dockerBin, ['rm', '-f', containerName]);
  if (imageTag && sourceType !== "image") {
    await tryRun(dockerBin, ['rmi', '-f', imageTag]);
  }
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
  const effectiveBaseDomain = opts.baseDomain || config.caddyBaseDomain;
  const scheme = effectiveBaseDomain === 'localhost' ? 'http' : 'https';
  const liveUrl = `${scheme}://${slug}.${effectiveBaseDomain}`;

  await onLog(`Starting container ${containerName} from image ${imageTag}`);

  const dockerArgs = [
    'run', '-d',
    '--name', containerName,
    '--network', config.dockerNetwork,
    '-l', DEQUEL_MANAGED_LABEL,
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
        await tryRun(dockerBin, ['volume', 'create', vol.volumeName], opts.targetServer);
        dockerArgs.push('-v', `${vol.volumeName}:${vol.mountPath}`);
      } else if (vol.hostPath) {
        dockerArgs.push('-v', `${vol.hostPath}:${vol.mountPath}`);
      }
    }
  }
  if (!opts.volumes?.length && opts.projectId) {
    const defaultVolume = `vol-${opts.projectId.slice(0, 12)}`;
    await tryRun(dockerBin, ['volume', 'create', defaultVolume], opts.targetServer);
    dockerArgs.push('-v', `${defaultVolume}:/app/data`);
  }

  await tryRun(dockerBin, ['network', 'create', config.dockerNetwork], opts.targetServer);
  dockerArgs.push(imageTag);

  await run(dockerBin, dockerArgs, opts.targetServer);
  await onLog(`Waiting for container ${containerName} to report running`);
  await waitForRunningContainer(containerName, 40, onLog);
  await tryRun(dockerBin, ['network', 'connect', config.dockerNetwork, containerName], opts.targetServer);

  const { buildCaddySnippet } = await import('../utils/domain-verifier');
  const caddySnippet = await buildCaddySnippet(slug, containerName, opts.projectId, undefined, opts.appPort);
  const { upsertRoute } = await import('../db/repo');
  const { baseDomainFor } = await import('../utils/routes');
  const { getIngressServer, shouldRouteViaIngress, projectServerSite, syncIngressRoute, upsertIngressRoute } = await import('../utils/ingress');
  const ingressServer = await getIngressServer();
  const viaIngress = shouldRouteViaIngress(opts.targetServer ?? null, ingressServer);
  const effectiveSnippet = viaIngress
    ? projectServerSite(`${slug}.${baseDomainFor()}`, opts.appPort ?? config.appInternalPort, [containerName], true)
    : caddySnippet;
  const routeInfo = {
    hostname: `${slug}.${baseDomainFor()}`,
    routeFile: `${slug}.caddy`,
    port: opts.appPort ?? config.appInternalPort,
    containers: [containerName],
  };

  if (opts.targetServer?.mode === 'ssh' || opts.targetServer?.mode === 'docker_tcp') {
    await onLog(`Syncing Caddy route to remote server (${opts.targetServer.name}): ${slug}.caddy`);
    await syncRemoteCaddyRoute(opts.targetServer, `${slug}.caddy`, effectiveSnippet);
    await upsertRoute({
      serverId: opts.targetServer.id,
      deploymentId: deploymentId,
      projectId: opts.projectId ?? null,
      hostname: `${slug}.${baseDomainFor()}`,
      routeFile: `${slug}.caddy`,
      port: opts.appPort ?? config.appInternalPort,
      targetContainers: [containerName],
      status: 'active',
    });
  } else {
    const caddyRouteFile = join(config.caddyRoutesDir, `${slug}.caddy`);
    await onLog(`Writing Caddy route file: ${caddyRouteFile}`);
    await writeFile(caddyRouteFile, effectiveSnippet, 'utf8');

    await onLog('Reloading Caddy to apply dynamic route');
    try { await reloadCaddy(); } catch (error) {
      await onLog(`Caddy reload failed (might not be ready): ${error instanceof Error ? error.message : String(error)}`);
    }
    await upsertRoute({
      serverId: 'local',
      deploymentId: deploymentId,
      projectId: opts.projectId ?? null,
      hostname: `${slug}.${baseDomainFor()}`,
      routeFile: `${slug}.caddy`,
      port: opts.appPort ?? config.appInternalPort,
      targetContainers: [containerName],
      status: 'active',
    });
  }

  if (viaIngress && ingressServer && opts.targetServer) {
    await onLog(`Registering ingress route on ${ingressServer.name} for ${routeInfo.hostname}`);
    await syncIngressRoute(ingressServer, opts.targetServer.host, routeInfo);
    await upsertIngressRoute(ingressServer.id, opts.projectId ?? null, deploymentId, opts.targetServer.host, routeInfo);
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
