import { describe, it, expect, mock } from 'bun:test';

const fileUrl = (relPath: string) => new URL(relPath, import.meta.url).toString();

let platformSettings: { ingressServerId: string | null } = { ingressServerId: null };
let servers: any[] = [];
let projects: any[] = [];
let deploymentsByProject: Record<string, any[]> = {};
let updatedProject: any = null;
let latestInactiveStatus: string | null = null;

mock.module(fileUrl('../../db/repo'), () => ({
  getPlatformSettings: mock(() => Promise.resolve(platformSettings)),
  getProjectById: mock((id: string) => Promise.resolve(projects.find((p) => p.id === id) ?? null)),
  getServerById: mock((id: string) => Promise.resolve(servers.find((s) => s.id === id) ?? null)),
  listProjects: mock(() => Promise.resolve(projects)),
  listDeployments: mock((projectId?: string) => Promise.resolve(projectId ? (deploymentsByProject[projectId] ?? []) : [])),
  createDeployment: mock((input: any) => Promise.resolve({ id: 'dep-new', ...input })),
  updateProject: mock((id: string, patch: any) => { updatedProject = patch; return Promise.resolve({ id, ...patch }); }),
  updateDeploymentStatus: mock((id: string, status: string) => { latestInactiveStatus = status; return Promise.resolve(); }),
  appendLog: mock(() => Promise.resolve({ sequence: 1 })),
  listDomains: mock(() => Promise.resolve([])),
  listEnvironmentVariablesForDeploy: mock(() => Promise.resolve([])),
  listVolumes: mock(() => Promise.resolve([])),
  updateDeploymentCommitSha: mock(() => Promise.resolve()),
  getDeploymentById: mock(() => Promise.resolve(null)),
  getScalingPolicy: mock(() => Promise.resolve(null)),
  deleteDeploymentAndLogs: mock(() => Promise.resolve()),
  listAllDatabases: mock(() => Promise.resolve([])),
  updateRouteStatus: mock(() => Promise.resolve()),
  updateDomainValidation: mock(() => Promise.resolve()),
  deleteRoutesByDeployment: mock(() => Promise.resolve()),
  getLogs: mock(() => Promise.resolve([])),
  createAgentJob: mock(() => Promise.resolve('job-1')),
  upsertRoute: mock(() => Promise.resolve({})),
  updateServerStatus: mock(() => Promise.resolve()),
  createAgentRegistrationToken: mock(() => Promise.resolve({ token: 'dqr_test', expiresAt: new Date().toISOString() })),
  listServers: mock(() => Promise.resolve(servers)),
  ensureLocalServer: mock(() => Promise.resolve()),
  createDeploymentEvent: mock(() => Promise.resolve()),
}));

const { failoverProject } = await import('../failover');

describe('failoverProject', () => {
  it('rejects when no ingress is configured', async () => {
    platformSettings = { ingressServerId: null };
    projects = [{ id: 'p1', serverId: 'a' }];
    await expect(failoverProject('p1')).rejects.toThrow('No ingress server configured');
  });

  it('rejects non-ssh project servers', async () => {
    platformSettings = { ingressServerId: 'ing' };
    servers = [{ id: 'ing', name: 'Ingress', mode: 'ssh' }];
    projects = [{ id: 'p1', serverId: 'a' }];
    servers.push({ id: 'a', name: 'AgentServer', mode: 'agent' });
    await expect(failoverProject('p1')).rejects.toThrow('only supports SSH project servers');
  });

  it('rejects when no other healthy server exists', async () => {
    platformSettings = { ingressServerId: 'ing' };
    servers = [{ id: 'ing', name: 'Ingress', mode: 'ssh' }];
    projects = [{ id: 'p1', serverId: 'a' }];
    servers.push({ id: 'a', name: 'AppServer', mode: 'ssh', status: 'connected' });
    deploymentsByProject = { p1: [{ id: 'dep-1', sourceType: 'git', sourceRef: 'https://github.com/x/y.git', branch: 'main' }] };
    await expect(failoverProject('p1')).rejects.toThrow('No other healthy server available');
  });

  it('rejects when only agent servers are available as targets', async () => {
    platformSettings = { ingressServerId: 'ing' };
    servers = [
      { id: 'ing', name: 'Ingress', mode: 'ssh' },
      { id: 'a', name: 'Current', mode: 'ssh', status: 'connected' },
      { id: 'b', name: 'Agent', mode: 'agent', lastHeartbeat: new Date().toISOString() },
    ];
    projects = [{ id: 'p1', serverId: 'a' }];
    deploymentsByProject = { p1: [{ id: 'dep-1', sourceType: 'git', sourceRef: 'https://github.com/x/y.git', branch: 'main' }] };
    await expect(failoverProject('p1')).rejects.toThrow('No other healthy server available');
  });

  it('delegates to ssh executor and marks old deployment inactive', async () => {
    platformSettings = { ingressServerId: 'ing' };
    servers = [
      { id: 'ing', name: 'Ingress', mode: 'ssh' },
      { id: 'a', name: 'Current', mode: 'ssh', status: 'connected' },
      { id: 'b', name: 'Target', mode: 'ssh', status: 'connected' },
    ];
    projects = [{ id: 'p1', name: 'proj-1', serverId: 'a' }];
    deploymentsByProject = { p1: [{ id: 'dep-1', sourceType: 'git', sourceRef: 'https://github.com/x/y.git', branch: 'main' }] };
    updatedProject = null;

    const deployment = await failoverProject('p1');
    expect(deployment.id).toBe('dep-new');
    expect(deployment.serverId).toBe('b');
    expect(updatedProject).toEqual({ serverId: 'b' });
  });
});
