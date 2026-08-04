import { spawn } from 'node:child_process';
import { config } from '../utils/config';
import { dockerBin } from '../utils/docker-bin';
import { DEQUEL_DATABASE_LABEL } from '../utils/dequel-labels';
import type { Database, DatabaseType } from '../types';
import {
  deleteDatabase,
  getDatabaseById,
  listAllDatabases,
  updateDatabaseRuntime,
  updateDatabaseStatus,
} from '../db/repo';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  run(cmd, args).catch(() => undefined);

const isMissingResource = (error: unknown) =>
  /No such (?:container|volume)|No such object/.test(error instanceof Error ? error.message : String(error));

export const ensureContainerRemoved = async (name: string): Promise<void> => {
  try {
    await run(dockerBin, ['rm', '-f', name]);
  } catch (error) {
    if (!isMissingResource(error)) throw error;
  }
};

export const ensureVolumeRemoved = async (name: string): Promise<void> => {
  try {
    await run(dockerBin, ['volume', 'rm', '-f', name]);
  } catch (error) {
    if (!isMissingResource(error)) throw error;
  }
};

export const resolveDbImage = (type: string, versionInput?: string | null): string => {
  if (type === 'postgresql') {
    const ver = versionInput || '18';
    const tag = ver.includes('alpine') || ver.includes('debian') || ver === 'latest' ? ver : `${ver}-alpine`;
    return `postgres:${tag}`;
  }
  if (type === 'mysql') {
    const ver = versionInput || '8.4';
    return `mysql:${ver}`;
  }
  if (type === 'redis') {
    const ver = versionInput || '8.0';
    const tag = ver.includes('alpine') || ver === 'latest' ? ver : `${ver}-alpine`;
    return `redis:${tag}`;
  }
  if (type === 'mongodb') {
    const ver = versionInput || '8.0';
    return `mongo:${ver}`;
  }
  throw new Error(`Unsupported database type: ${type}`);
};

type EngineRuntimeConfig = { volumeTarget: string; envVars: string[]; extraCmdArgs: string[] };

const ENGINE_RUNTIME_CONFIGS: Record<DatabaseType, (dbRecord: Database) => EngineRuntimeConfig> = {
  postgresql: (dbRecord) => {
    const major = Number((dbRecord.version ?? '18').match(/^\d+/)?.[0]);
    if (!Number.isInteger(major)) {
      throw new Error(`PostgreSQL version ${dbRecord.version} must be a numeric major version`);
    }
    return {
      volumeTarget: major >= 18 ? '/var/lib/postgresql' : '/var/lib/postgresql/data',
      envVars: [
        `POSTGRES_USER=${dbRecord.username}`,
        `POSTGRES_PASSWORD=${dbRecord.password}`,
        `POSTGRES_DB=${dbRecord.databaseName}`,
      ],
      extraCmdArgs: [],
    };
  },
  mysql: (dbRecord) => ({
    volumeTarget: '/var/lib/mysql',
    envVars: [
      `MYSQL_ROOT_PASSWORD=${dbRecord.password}`,
      `MYSQL_DATABASE=${dbRecord.databaseName}`,
      `MYSQL_USER=${dbRecord.username}`,
      `MYSQL_PASSWORD=${dbRecord.password}`,
    ],
    extraCmdArgs: [],
  }),
  redis: (dbRecord) => ({
    volumeTarget: '/data',
    envVars: [],
    extraCmdArgs: ['redis-server', '--requirepass', dbRecord.password],
  }),
  mongodb: (dbRecord) => ({
    volumeTarget: '/data/db',
    envVars: [
      `MONGO_INITDB_ROOT_USERNAME=${dbRecord.username}`,
      `MONGO_INITDB_ROOT_PASSWORD=${dbRecord.password}`,
      `MONGO_INITDB_DATABASE=${dbRecord.databaseName}`,
    ],
    extraCmdArgs: [],
  }),
};

const resolveEngineConfig = (dbRecord: Database): EngineRuntimeConfig => {
  const resolver = ENGINE_RUNTIME_CONFIGS[dbRecord.type];
  if (!resolver) throw new Error(`Unsupported database type: ${dbRecord.type}`);
  return resolver(dbRecord);
};

const provisionInFlight = new Map<string, Promise<void>>();

export const provisionDatabase = async (dbRecord: Database): Promise<void> => {
  const task = runProvision(dbRecord).finally(() => provisionInFlight.delete(dbRecord.id));
  provisionInFlight.set(dbRecord.id, task);
  await task;
};

export const waitForProvision = (id: string): Promise<void> =>
  provisionInFlight.get(id) ?? Promise.resolve();

const runProvision = async (dbRecord: Database): Promise<void> => {
  const containerName = dbRecord.internalHost;
  let createdVolume = false;

  const stillProvisioning = async () => {
    const current = await getDatabaseById(dbRecord.id);
    return current !== null && current.status === 'provisioning';
  };

  const abortIfDeleted = async () => {
    if (!(await stillProvisioning())) {
      if (createdVolume) await ensureVolumeRemoved(dbRecord.volumeName).catch(() => {});
      await ensureContainerRemoved(containerName).catch(() => {});
      await ensureContainerRemoved(publicProxyName(dbRecord)).catch(() => {});
      return true;
    }
    return false;
  };

  try {
    const image = resolveDbImage(dbRecord.type, dbRecord.version);
    const { volumeTarget, envVars, extraCmdArgs } = resolveEngineConfig(dbRecord);
    await run(dockerBin, ['pull', image]);
    if (await abortIfDeleted()) return;

    await run(dockerBin, ['volume', 'create', dbRecord.volumeName]);
    createdVolume = true;
    await ensureContainerRemoved(containerName);
    if (await abortIfDeleted()) return;

    const args = [
      'run', '-d',
      '--name', containerName,
      '--network', config.dockerNetwork,
      '--network-alias', containerName,
      '--restart', 'unless-stopped',
      '-l', DEQUEL_DATABASE_LABEL,
      ...(dbRecord.cpuLimit ? ['--cpus', String(dbRecord.cpuLimit)] : []),
      ...(dbRecord.memoryLimitMb ? ['--memory', `${Math.round(dbRecord.memoryLimitMb)}m`] : []),
      '-v', `${dbRecord.volumeName}:${volumeTarget}`,
      '-e', 'TZ=UTC',
      ...envVars.flatMap(e => ['-e', e]),
      image,
      ...extraCmdArgs,
    ];

    await run(dockerBin, args);

    let externalPort: number | null = null;
    let proxyContainerName: string | null = null;
    if (dbRecord.publicAccess) {
      const proxy = await provisionPublicProxy(dbRecord);
      externalPort = proxy.externalPort;
      proxyContainerName = proxy.containerName;
    }

    if (await abortIfDeleted()) return;

    for (let i = 0; i < 30; i++) {
      try {
        const status = await run(dockerBin, ['inspect', '-f', '{{.State.Status}}', containerName]);
        if (status.trim() === 'running') {
          await updateDatabaseRuntime(dbRecord.id, { externalPort, proxyContainerName });
          await updateDatabaseStatus(dbRecord.id, 'running', containerName);
          return;
        }
      } catch {}
      await sleep(2000);
    }

    if (proxyContainerName) await ensureContainerRemoved(proxyContainerName).catch(() => {});
    await updateDatabaseStatus(dbRecord.id, 'failed', containerName);
    throw new Error(`Database ${containerName} failed to become ready within 60 seconds`);
  } catch (err) {
    console.error(`[DB Provisioner] Error provisioning database ${dbRecord.id}:`, err);
    await deprovisionDatabase({ ...dbRecord, proxyContainerName: publicProxyName(dbRecord) }).catch(() => {});
    await updateDatabaseStatus(dbRecord.id, 'failed', containerName).catch(() => {});
    throw err;
  }
};

export const deprovisionDatabase = async (dbRecord: Database): Promise<void> => {
  await ensureContainerRemoved(dbRecord.proxyContainerName ?? publicProxyName(dbRecord));
  await ensureContainerRemoved(dbRecord.internalHost);
  await ensureVolumeRemoved(dbRecord.volumeName);
};

export const publicProxyName = (dbRecord: Database): string =>
  `${dbRecord.internalHost}-public`;

export const proxyConfig = (dbRecord: Database, port: number): string => {
  const rules = dbRecord.allowPublicAccessFromAnywhere
    ? ''
    : `  acl allowed src ${dbRecord.allowedCidrs.join(' ')}\n  tcp-request connection reject if !allowed\n`;
  return [
    'global',
    'defaults',
    '  mode tcp',
    '  timeout connect 5s',
    '  timeout client 1h',
    '  timeout server 1h',
    'frontend database',
    `  bind 0.0.0.0:${port}`,
    rules,
    '  default_backend database',
    'backend database',
    `  server database ${dbRecord.internalHost}:${dbRecord.internalPort} check`,
  ].join('\n') + '\n';
};

const PUBLIC_PORT_MIN = 20000;
const PUBLIC_PORT_MAX = 40000;

const provisionPublicProxy = async (dbRecord: Database): Promise<{ containerName: string; externalPort: number }> => {
  const containerName = publicProxyName(dbRecord);
  await run(dockerBin, ['pull', 'haproxy:3.0-alpine']);
  for (let attempt = 0; attempt < 20; attempt++) {
    const externalPort = PUBLIC_PORT_MIN + Math.floor(Math.random() * (PUBLIC_PORT_MAX - PUBLIC_PORT_MIN));
    const configText = proxyConfig(dbRecord, externalPort);
    await ensureContainerRemoved(containerName);
    try {
      await run(dockerBin, [
        'run', '-d',
        '--name', containerName,
        '--network', config.dockerNetwork,
        '-p', `${externalPort}:${externalPort}`,
        '--restart', 'unless-stopped',
        '-l', DEQUEL_DATABASE_LABEL,
        '-e', `DEQUEL_HAPROXY_CONFIG=${configText}`,
        'haproxy:3.0-alpine',
        'sh', '-c', 'printf "%s" "$DEQUEL_HAPROXY_CONFIG" > /tmp/haproxy.cfg && exec haproxy -f /tmp/haproxy.cfg',
      ]);
    } catch {
      await ensureContainerRemoved(containerName).catch(() => {});
      continue;
    }
    await sleep(1500);
    try {
      const status = await run(dockerBin, ['inspect', '-f', '{{.State.Status}}', containerName]);
      if (status.trim() === 'running') return { containerName, externalPort };
    } catch {}
    await ensureContainerRemoved(containerName);
  }
  throw new Error('Could not allocate a free port for public database access');
};

export const stopDatabase = async (dbRecord: Database): Promise<void> => {
  if (dbRecord.proxyContainerName) await tryRun(dockerBin, ['stop', '-t', '5', dbRecord.proxyContainerName]);
  await run(dockerBin, ['stop', '-t', '10', dbRecord.internalHost]);
  await updateDatabaseStatus(dbRecord.id, 'stopped');
};

export const startDatabase = async (dbRecord: Database): Promise<void> => {
  await run(dockerBin, ['start', dbRecord.internalHost]);
  if (dbRecord.proxyContainerName) await run(dockerBin, ['start', dbRecord.proxyContainerName]);
  await updateDatabaseStatus(dbRecord.id, 'running');
};

export const restartDatabase = async (dbRecord: Database): Promise<void> => {
  await updateDatabaseStatus(dbRecord.id, 'restarting');
  await run(dockerBin, ['restart', dbRecord.internalHost]);
  if (dbRecord.proxyContainerName) await run(dockerBin, ['restart', dbRecord.proxyContainerName]);
  await updateDatabaseStatus(dbRecord.id, 'running');
};

export const measureDatabaseStorage = async (dbRecord: Database): Promise<number> => {
  const output = await run(dockerBin, [
    'run', '--rm',
    '-v', `${dbRecord.volumeName}:/data:ro`,
    'alpine:3.20',
    'du', '-sm', '/data',
  ]);
  const usedMb = Number.parseInt(output, 10) || 0;
  await updateDatabaseRuntime(dbRecord.id, { storageUsedMb: usedMb });
  return usedMb;
};

const STORAGE_MEASURE_INTERVAL_MS = 10 * 60_000;
const lastStorageMeasure = new Map<string, number>();

const reconcileMissingContainer = async (dbRecord: Database) => {
  if (dbRecord.status === 'running' || dbRecord.status === 'restarting') {
    await updateDatabaseStatus(dbRecord.id, 'failed');
  }
};

export const startDatabaseMonitoring = () => {
  let checkInFlight = false;
  const check = async () => {
    if (checkInFlight) return;
    checkInFlight = true;
    try {
      for (const dbRecord of await listAllDatabases()) {
        if (dbRecord.status === 'deleting' || dbRecord.status === 'deletion_failed') {
          try {
            await deprovisionDatabase(dbRecord);
            await deleteDatabase(dbRecord.id);
          } catch (error) {
            console.warn(`[Database] Cleanup retry failed for ${dbRecord.id}:`, error);
          }
          continue;
        }
        try {
          const inspect = await run(dockerBin, ['inspect', '-f', '{{.State.Status}}', dbRecord.internalHost]);
          const running = inspect.trim() === 'running';
          if (dbRecord.status === 'running' && !running) {
            await updateDatabaseStatus(dbRecord.id, 'stopped');
          } else if (dbRecord.status === 'stopped' && running) {
            await updateDatabaseStatus(dbRecord.id, 'running');
          } else if (dbRecord.status === 'restarting') {
            const inspectStatus = inspect.trim();
            if (inspectStatus === 'restarting') continue;
            await updateDatabaseStatus(dbRecord.id, inspectStatus === 'running' ? 'running' : 'failed');
          } else if (dbRecord.status === 'provisioning' && !provisionInFlight.has(dbRecord.id)) {
            await updateDatabaseStatus(dbRecord.id, running ? 'running' : 'failed');
          }
          if (running) {
            const lastMeasured = lastStorageMeasure.get(dbRecord.id) ?? 0;
            if (Date.now() - lastMeasured >= STORAGE_MEASURE_INTERVAL_MS) {
              lastStorageMeasure.set(dbRecord.id, Date.now());
              const usedMb = await measureDatabaseStorage(dbRecord);
              if (dbRecord.storageLimitMb && usedMb >= dbRecord.storageLimitMb) {
                console.warn(`[Database] ${dbRecord.name} storage limit reached (${usedMb}/${dbRecord.storageLimitMb} MB)`);
              } else if (dbRecord.storageLimitMb && usedMb >= dbRecord.storageLimitMb * 0.8) {
                console.warn(`[Database] ${dbRecord.name} storage usage above 80% (${usedMb}/${dbRecord.storageLimitMb} MB)`);
              }
            }
          }
        } catch (error) {
          if (isMissingResource(error)) {
            await reconcileMissingContainer(dbRecord);
          } else {
            console.warn(`[Database] Monitoring skipped for ${dbRecord.id}:`, error);
          }
        }
      }
    } finally {
      checkInFlight = false;
    }
  };
  void check();
  return setInterval(() => void check(), 60_000);
};
