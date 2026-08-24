import { describe, it, expect, mock, beforeEach } from 'bun:test';

const fileUrl = (relPath: string) => new URL(relPath, import.meta.url).toString();

let cleanupFailedDeploymentCalled = false;
let buildShouldFail = false;

beforeEach(() => {
  cleanupFailedDeploymentCalled = false;
  buildShouldFail = false;
});

const mockDb = {
  getDeploymentById: mock(() => Promise.resolve({
    id: 'dep-1',
    projectId: 'proj-1',
    sourceType: 'git',
    sourceRef: 'https://github.com/test/repo.git',
    branch: 'main',
    status: 'pending',
    commitSha: null,
    clearCache: false,
    environment: null,
    imageTag: null,
    containerName: null,
  })),
  getProjectById: mock(() => Promise.resolve({
    id: 'proj-1',
    name: 'Test Project',
    sourceDir: null,
    port: 3000,
    cpuLimit: null,
    memoryLimitMb: null,
    repoUrl: 'https://github.com/test/repo.git',
  })),
  updateDeploymentStatus: mock(() => Promise.resolve()),
  updateDeploymentCommitSha: mock(() => Promise.resolve()),
  appendLog: mock(async (_depId: string, stage: string, message: string) => {
    if (stage === 'system' && message === 'Deployment is running') {
      throw new Error('Simulated DB write failure');
    }
    return { sequence: 1 };
  }),
  listEnvironmentVariablesForDeploy: mock(() => Promise.resolve([])),
  listVolumes: mock(() => Promise.resolve([])),
  listDeployments: mock(() => Promise.resolve([])),
  listAllDatabases: mock(() => Promise.resolve([])),
  deleteDeploymentAndLogs: mock(() => Promise.resolve()),
  getScalingPolicy: mock(() => Promise.resolve(null)),
  getServerById: mock(() => Promise.resolve(null)),
  createAgentJob: mock(() => Promise.resolve('job-1')),
  upsertRoute: mock(() => Promise.resolve({})),
  updateServerStatus: mock(() => Promise.resolve()),
  createAgentRegistrationToken: mock(() => Promise.resolve({ token: 'dqr_test', expiresAt: new Date().toISOString() })),
  getPlatformSettings: mock(() => Promise.resolve({ ingressServerId: null })),
  listServers: mock(() => Promise.resolve([])),
  listProjects: mock(() => Promise.resolve([])),
  ensureLocalServer: mock(() => Promise.resolve()),
  deleteRoutesByDeployment: mock(() => Promise.resolve()),
  updateRouteStatus: mock(() => Promise.resolve()),
  updateDomainValidation: mock(() => Promise.resolve()),
  listDomains: mock(() => Promise.resolve([])),
  createDeploymentEvent: mock(() => Promise.resolve()),
};

mock.module(fileUrl('../../db/repo'), () => mockDb);

mock.module(fileUrl('../runtime'), () => ({
  deployContainer: mock(() => Promise.resolve({
    containerName: 'test-project-abc12345',
    liveUrl: 'http://test-project.localhost',
  })),
  cleanupFailedDeployment: mock(async () => {
    cleanupFailedDeploymentCalled = true;
  }),
  ensureContainerRunning: mock(() => Promise.resolve()),
  reloadCaddy: mock(() => Promise.resolve()),
  tryRun: mock(() => Promise.resolve('')),
}));

mock.module(fileUrl('../railpack'), () => ({
  buildWithRailpack: mock(async (
    _workspace: string,
    _imageTag: string,
    _onLog: (line: string) => Promise<void>,
    _opts?: unknown,
  ) => {
    if (buildShouldFail) throw new Error('Build failed');
  }),
  CancelledError: class CancelledError extends Error {
    constructor() { super('Cancelled'); }
  },
}));

mock.module(fileUrl('../source'), () => ({
  prepareSourceWorkspace: mock(() => Promise.resolve('/tmp/workspace/dep-1')),
  prepareUploadWorkspace: mock(() => Promise.resolve('/tmp/workspace/dep-1')),
  cleanupWorkspace: mock(() => Promise.resolve()),
  getHeadSha: mock(() => Promise.resolve('abc123def456')),
}));

mock.module(fileUrl('../../utils/grafana'), () => ({
  ensureProjectDashboard: mock(() => Promise.resolve()),
}));

mock.module('ioredis', () => ({
  default: class FakeRedis {
    queue: string[] = [];
    rpush = mock(async (_key: string, ...values: string[]) => { this.queue.push(...values); });
    blpop = mock(async () => { const v = this.queue.shift(); return v ? ['queue', v] : null; });
    lrem = mock(async () => {});
    zadd = mock(async () => {});
    zrem = mock(async () => {});
    zrangebyscore = mock(async () => []);
    quit = mock(async () => {});
  },
}));

const { PipelineOrchestrator } = await import('../pipeline');

describe('runDeployment cleanup behavior', () => {
  it('does NOT call cleanupFailedDeployment when failure occurs after deployContainer succeeds', async () => {
    const orchestrator = new PipelineOrchestrator();
    await (orchestrator as any).runDeployment('dep-1');

    expect(cleanupFailedDeploymentCalled).toBe(false);
  });

  it('calls cleanupFailedDeployment when failure occurs during build (before deployContainer)', async () => {
    buildShouldFail = true;
    const orchestrator = new PipelineOrchestrator();
    await (orchestrator as any).runDeployment('dep-1');

    expect(cleanupFailedDeploymentCalled).toBe(true);
  });
});
