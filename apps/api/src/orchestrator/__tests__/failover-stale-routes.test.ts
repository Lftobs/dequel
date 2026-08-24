import { describe, it, expect } from 'bun:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const run = () =>
  exec('bun', ['run', 'src/orchestrator/__tests__/failover-stale-routes-runner.ts'], {
    cwd: import.meta.dir + '/../../..',
    timeout: 30000,
    env: { ...process.env, TEST_DATABASE_URL: 'postgresql://dequel:dequel@localhost:5433/dequel' },
  });

const parse = (stdout: string) => {
  const lines = stdout.trim().split('\n');
  return JSON.parse(lines[lines.length - 1]);
};

describe('failover monitor - stale route cleanup', () => {
  it('cleans up stale routes when a previously unreachable server recovers', async () => {
    const { stdout } = await run();
    const r = parse(stdout);

    expect(r.test1_firstTick.removedEmpty).toBe(true);
    expect(r.test1_firstTick.updatesEmpty).toBe(true);

    expect(r.test1_recovered.removedFiles).toEqual([{ hostname: 'p1.app.com', routeFile: 'p1.conf' }]);
    expect(r.test1_recovered.updates).toEqual([{ hostname: 'p1.app.com', status: 'removed', serverId: 'srv-a' }]);
  });

  it('does not clean up routes when server was never unreachable', async () => {
    const { stdout } = await run();
    const r = parse(stdout);
    expect(r.test2.removedEmpty).toBe(true);
    expect(r.test2.updatesEmpty).toBe(true);
  });

  it('keeps routes when recovered server is still the project server', async () => {
    const { stdout } = await run();
    const r = parse(stdout);
    expect(r.test3.removedEmpty).toBe(true);
    expect(r.test3.updatesEmpty).toBe(true);
  });
});
