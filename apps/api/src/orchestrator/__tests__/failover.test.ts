import { describe, it, expect } from 'bun:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const run = () =>
  exec('bun', ['run', 'src/orchestrator/__tests__/failover-runner.ts'], {
    cwd: import.meta.dir + '/../../..',
    timeout: 30000,
  });

const parse = (stdout: string) => {
  const lines = stdout.trim().split('\n');
  return JSON.parse(lines[lines.length - 1]);
};

describe('failoverProject', () => {
  it('rejects when no ingress is configured', async () => {
    const { stdout } = await run();
    const r = parse(stdout);
    expect(r.test1.ok).toBe(true);
  });

  it('rejects non-ssh project servers', async () => {
    const { stdout } = await run();
    const r = parse(stdout);
    expect(r.test2.ok).toBe(true);
  });

  it('rejects when no other healthy server exists', async () => {
    const { stdout } = await run();
    const r = parse(stdout);
    expect(r.test3.ok).toBe(true);
  });

  it('rejects when only agent servers are available as targets', async () => {
    const { stdout } = await run();
    const r = parse(stdout);
    expect(r.test4.ok).toBe(true);
  });

  it('delegates to ssh executor and marks old deployment inactive', async () => {
    const { stdout } = await run();
    const r = parse(stdout);
    expect(r.test5.ok).toBe(true);
  });
});
