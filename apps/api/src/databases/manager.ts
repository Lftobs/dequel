import { spawn } from 'node:child_process';
import { config } from '../utils/config';
import { dockerBin } from '../utils/docker-bin';
import type { Database } from '../types';
import { updateDatabaseStatus } from '../db/repo';

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

export const provisionDatabase = async (dbRecord: Database): Promise<void> => {
  const containerName = dbRecord.internalHost;

  const version = dbRecord.version || (dbRecord.type === 'mysql' ? '8.0' : '16-alpine');
  const image = dbRecord.type === 'mysql' ? `mysql:${version}` : `postgres:${version}`;

  // Pull image first (non-blocking)
  await tryRun(dockerBin, ['pull', image]);

  const envVars = dbRecord.type === 'mysql'
    ? [
        `MYSQL_ROOT_PASSWORD=${dbRecord.password}`,
        `MYSQL_DATABASE=${dbRecord.databaseName}`,
        `MYSQL_USER=${dbRecord.username}`,
        `MYSQL_PASSWORD=${dbRecord.password}`,
      ]
    : [
        `POSTGRES_USER=${dbRecord.username}`,
        `POSTGRES_PASSWORD=${dbRecord.password}`,
        `POSTGRES_DB=${dbRecord.databaseName}`,
      ];

  const volumeName = `db-${dbRecord.id.slice(0, 12)}`;

  // Create volume
  await tryRun(dockerBin, ['volume', 'create', volumeName]);

  const args = [
    'run', '-d',
    '--name', containerName,
    '--network', config.dockerNetwork,
    '--network-alias', containerName,
    ...(dbRecord.cpuLimit ? ['--cpus', String(dbRecord.cpuLimit)] : []),
    ...(dbRecord.memoryLimitMb ? ['--memory', `${Math.round(dbRecord.memoryLimitMb)}m`] : []),
    '-v', `${volumeName}:/var/lib/${dbRecord.type === 'mysql' ? 'mysql' : 'postgresql/data'}`,
    '-e', `TZ=UTC`,
    ...envVars.flatMap(e => ['-e', e]),
    image,
  ];

  await run(dockerBin, args);

  // Wait for healthy
  for (let i = 0; i < 30; i++) {
    try {
      const status = await run(dockerBin, ['inspect', '-f', '{{.State.Status}}', containerName]);
      if (status.trim() === 'running') {
        await updateDatabaseStatus(dbRecord.id, 'running', containerName);
        return;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }

  await updateDatabaseStatus(dbRecord.id, 'failed', containerName);
};

export const deprovisionDatabase = async (dbRecord: Database): Promise<void> => {
  await tryRun(dockerBin, ['stop', '-t', '5', dbRecord.internalHost]);
  await tryRun(dockerBin, ['rm', '-f', dbRecord.internalHost]);
};
