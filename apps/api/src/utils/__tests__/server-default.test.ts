import { describe, it, expect, mock, beforeEach } from 'bun:test';

const fileUrl = (relPath: string) => new URL(relPath, import.meta.url).toString();

let servers: any[] = [];
let projects: any[] = [];

mock.module(fileUrl('../../db/repo'), () => ({
  listServers: mock(() => Promise.resolve(servers)),
  listProjects: mock(() => Promise.resolve(projects)),
  ensureLocalServer: mock(() => Promise.resolve()),
  getServerById: mock((id: string) => Promise.resolve(servers.find((s) => s.id === id) ?? null)),
  getProjectById: mock(() => Promise.resolve(null)),
  listDeployments: mock(() => Promise.resolve([])),
  getScalingPolicy: mock(() => Promise.resolve(null)),
  createAgentJob: mock(() => Promise.resolve('job-1')),
  upsertRoute: mock(() => Promise.resolve({})),
  updateServerStatus: mock(() => Promise.resolve()),
  createAgentRegistrationToken: mock(() => Promise.resolve({ token: 'dqr_test', expiresAt: new Date().toISOString() })),
  getPlatformSettings: mock(() => Promise.resolve({ ingressServerId: null })),
  updateDeploymentStatus: mock(() => Promise.resolve()),
  listEnvironmentVariablesForDeploy: mock(() => Promise.resolve([])),
  listDomains: mock(() => Promise.resolve([])),
  updateDomainValidation: mock(() => Promise.resolve()),
  updateDeploymentCommitSha: mock(() => Promise.resolve()),
  appendLog: mock(() => Promise.resolve()),
  listVolumes: mock(() => Promise.resolve([])),
  listAllDatabases: mock(() => Promise.resolve([])),
  deleteDeploymentAndLogs: mock(() => Promise.resolve()),
  getDeploymentById: mock(() => Promise.resolve(null)),
  updateRouteStatus: mock(() => Promise.resolve()),
  deleteRoutesByDeployment: mock(() => Promise.resolve()),
  createDeployment: mock(() => Promise.resolve({})),
  updateProject: mock(() => Promise.resolve({})),
  getLogs: mock(() => Promise.resolve([])),
}));

const { pickBestServer } = await import('../server-default');

beforeEach(() => {
  servers = [];
  projects = [];
});

describe('pickBestServer', () => {
  it('prefers a healthy preferred server', async () => {
    servers = [
      { id: 'a', mode: 'ssh', status: 'connected', cpuUsedPercent: 80 },
      { id: 'b', mode: 'ssh', status: 'connected', cpuUsedPercent: 5 },
    ];
    expect(await pickBestServer('a')).toBe('a');
  });

  it('ignores unhealthy servers and falls back to local', async () => {
    servers = [
      { id: 'a', mode: 'ssh', status: 'failed', cpuUsedPercent: 5 },
      { id: 'b', mode: 'agent', lastHeartbeat: new Date(Date.now() - 600_000).toISOString() },
    ];
    expect(await pickBestServer('a')).toBe('local');
  });

  it('picks the server with the fewest projects, then lowest load', async () => {
    servers = [
      { id: 'a', mode: 'ssh', status: 'connected', cpuUsedPercent: 10 },
      { id: 'b', mode: 'ssh', status: 'connected', cpuUsedPercent: 90 },
      { id: 'c', mode: 'ssh', status: 'connected', cpuUsedPercent: 50 },
    ];
    projects = [{ id: 'p1', serverId: 'a' }, { id: 'p2', serverId: 'a' }, { id: 'p3', serverId: 'b' }];
    expect(await pickBestServer()).toBe('c');
  });

  it('excludes the current server during failover', async () => {
    servers = [
      { id: 'a', mode: 'ssh', status: 'connected', cpuUsedPercent: 10 },
      { id: 'b', mode: 'ssh', status: 'connected', cpuUsedPercent: 20 },
    ];
    expect(await pickBestServer(null, 'a')).toBe('b');
  });

  it('filters candidates by mode', async () => {
    servers = [
      { id: 'a', mode: 'ssh', status: 'connected', cpuUsedPercent: 10 },
      { id: 'b', mode: 'agent', lastHeartbeat: new Date().toISOString(), cpuUsedPercent: 5 },
    ];
    expect(await pickBestServer(null, null, ['ssh'])).toBe('a');
    expect(await pickBestServer(null, null, ['agent'])).toBe('b');
  });

  it('treats agent servers with heartbeat older than 90s as unhealthy', async () => {
    servers = [
      { id: 'a', mode: 'agent', lastHeartbeat: new Date(Date.now() - 91_000).toISOString() },
    ];
    expect(await pickBestServer()).toBe('local');
  });

  it('accepts agent servers with heartbeat within 90s', async () => {
    servers = [
      { id: 'a', mode: 'agent', lastHeartbeat: new Date(Date.now() - 89_000).toISOString() },
    ];
    expect(await pickBestServer()).toBe('a');
  });

  it('rejects unhealthy preferred and falls through to best candidate', async () => {
    servers = [
      { id: 'a', mode: 'ssh', status: 'failed', cpuUsedPercent: 0 },
      { id: 'b', mode: 'ssh', status: 'connected', cpuUsedPercent: 10 },
    ];
    expect(await pickBestServer('a')).toBe('b');
  });
});