import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://dequel:dequel@localhost:5433/dequel';

const runRepo = async () => {
  const result = await execFileAsync(
    process.execPath,
    [path.join(__dirname, 'routes-repo-runner.ts')],
    {
      env: { ...process.env, TEST_DATABASE_URL },
      timeout: 30_000,
    },
  );
  return JSON.parse(result.stdout);
};

describe('routes repo', () => {
  it('CRUD lifecycle', async () => {
    const result = await runRepo();
    expect(result.upsert.status).toBe('pending');
    expect(result.upsert.confirmedAt).toBeNull();
    expect(result.listAfterUpsert).toHaveLength(1);
    expect(result.listAfterUpsert[0].targetContainers).toEqual(['deploy-dep-1']);

    expect(result.active.status).toBe('active');
    expect(result.active.confirmedAt).not.toBeNull();

    expect(result.upsertActiveKept.status).toBe('active');
    expect(result.upsertActiveKept.confirmedAt).not.toBeNull();
    expect(result.upsertActiveKept.targetContainers).toEqual(['deploy-dep-1', 'deploy-dep-1-replica-2']);

    expect(result.failed.status).toBe('failed');
    expect(result.failed.lastError).toBe('Caddy reload failed');
    expect(result.failed.confirmedAt).toBeNull();

    expect(result.filteredByServer).toHaveLength(1);
    expect(result.filteredByServer[0].hostname).toBe('other.localhost:80');

    expect(result.afterDeleteByDeployment).toEqual(['dep-2']);
    expect(result.getDeleted).toBeNull();

    expect(result.separatePerServer.serverIngress).toHaveLength(1);
    expect(result.separatePerServer.serverIngress[0].upstreamHost).toBe('203.0.113.10');
    expect(result.separatePerServer.server2).toHaveLength(1);
    expect(result.separatePerServer.server2[0].upstreamHost).toBeNull();
  }, 30_000);
});
