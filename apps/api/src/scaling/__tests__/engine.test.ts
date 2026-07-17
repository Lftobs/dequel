import { describe, it, expect, mock, beforeEach, afterAll } from 'bun:test';

const TEST_DEPLOYMENT = { id: 'dep-1', projectId: 'proj-1', containerName: 'deploy-dep-1' };

const TEST_POLICY = {
  id: 'pol-1', projectId: 'proj-1', enabled: true,
  minReplicas: 1, maxReplicas: 5,
  cpuThresholdPercent: 70, memoryThresholdPercent: 85,
  cooldownSeconds: 120, createdAt: '', updatedAt: '',
};

// Mock state variables
let mockRunImpl: ((cmd: string, args: string[]) => Promise<string>) | null = null;
let mockTryRunImpl: ((cmd: string, args: string[]) => Promise<string>) | null = null;
let mockReadFileContent: string | null = null;
let mockWriteFilePath: string | null = null;
let mockWriteContent: string | null = null;
let mockRedisData: Record<string, string> = {};
let mockGetScalingPolicyResult: ((id: string) => any) | null = null;
let mockListEnvVarsResult: any[] = [];

beforeEach(() => {
  mockRunImpl = null;
  mockTryRunImpl = null;
  mockReadFileContent = null;
  mockWriteFilePath = null;
  mockWriteContent = null;
  mockRedisData = {};
  mockGetScalingPolicyResult = null;
  mockListEnvVarsResult = [];
});

afterAll(() => {
  mockRunImpl = null;
  mockTryRunImpl = null;
  mockReadFileContent = null;
  mockWriteFilePath = null;
  mockWriteContent = null;
  mockRedisData = {};
  mockGetScalingPolicyResult = null;
  mockListEnvVarsResult = [];
});

// Mock docker-utils
const fileUrl = (path: string) => new URL(path, import.meta.url).toString();
mock.module(fileUrl('../docker-utils'), () => ({
  run: mock((cmd: string, args: string[]) => {
    if (mockRunImpl) return mockRunImpl(cmd, args);
    return Promise.resolve('');
  }),
  tryRun: mock((cmd: string, args: string[]) => {
    if (mockTryRunImpl) return mockTryRunImpl(cmd, args);
    return Promise.resolve('');
  }),
}));

// Mock fs
mock.module('node:fs/promises', () => {
  const fs = require('node:fs');
  const pathMod = require('node:path');
  return {
    readFile: mock(async (path: string, options?: any) => {
      if (mockReadFileContent !== null) {
        return mockReadFileContent;
      }
      if (fs.existsSync(path)) {
        return fs.readFileSync(path, options || 'utf8');
      }
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }),
    writeFile: mock(async (path: string, content: string, options?: any) => {
      mockWriteFilePath = path;
      mockWriteContent = content;
      const dir = pathMod.dirname(path);
      if (fs.existsSync(dir)) {
        fs.writeFileSync(path, content, options || 'utf8');
      }
    }),
  };
});

// Mock redis
mock.module('ioredis', () => ({
  default: class FakeRedis {
    hgetall = mock(async () => mockRedisData);
    hset = mock(async (_key: string, data: Record<string, string>) => {
      mockRedisData = { ...mockRedisData, ...data };
    });
    quit = mock(async () => {});
  },
}));

// Mock db/repo
mock.module(fileUrl('../../db/repo'), () => ({
  getProjectById: mock(() => Promise.resolve(null)),
  listDeployments: mock(() => Promise.resolve([])),
  getScalingPolicy: mock((id: string) =>
    mockGetScalingPolicyResult ? Promise.resolve(mockGetScalingPolicyResult(id)) : Promise.resolve(null)
  ),
  updateDeploymentStatus: mock(() => Promise.resolve()),
  listEnvironmentVariablesForDeploy: mock(() => Promise.resolve(mockListEnvVarsResult)),
  listDomains: mock(() => Promise.resolve([])),
  updateDomainValidation: mock(() => Promise.resolve()),
}));

mock.module(fileUrl('../../utils/config'), () => ({
  config: {
    redisUrl: 'redis://localhost:6379',
    caddyRoutesDir: '/tmp/dequel-test-routes',
    caddyBaseDomain: 'localhost',
    appInternalPort: 3000,
    dockerNetwork: 'dequel_net',
  },
}));


mock.module(fileUrl('../../utils/docker-bin'), () => ({ dockerBin: '/usr/bin/docker' }));

const { scalingEngine } = await import('../engine');

// --- Tests ---

describe('parseMemToMb', () => {
  it('converts GiB to MB', () => {
    expect((scalingEngine as any).parseMemToMb('2GiB')).toBe(2048);
  });

  it('converts MiB directly', () => {
    expect((scalingEngine as any).parseMemToMb('512MiB')).toBe(512);
  });

  it('converts KiB to MB', () => {
    expect((scalingEngine as any).parseMemToMb('1024KiB')).toBe(1);
  });

  it('returns 0 for unrecognized format', () => {
    expect((scalingEngine as any).parseMemToMb('')).toBe(0);
    expect((scalingEngine as any).parseMemToMb('abc')).toBe(0);
  });

  it('handles MB format', () => {
    expect((scalingEngine as any).parseMemToMb('256MB')).toBe(256);
  });
});

describe('getCurrentReplicas', () => {
  it('returns 1 when no route file exists', async () => {
    mockReadFileContent = null;
    const result = await (scalingEngine as any).getCurrentReplicas('proj-1');
    expect(result).toBe(1);
  });

  it('returns 1 when no reverse_proxy in file', async () => {
    mockReadFileContent = 'proj-1.localhost:80 {\n  log\n}\n';
    const result = await (scalingEngine as any).getCurrentReplicas('proj-1');
    expect(result).toBe(1);
  });

  it('counts unique containers in reverse_proxy targets', async () => {
    mockReadFileContent = 'proj-1.localhost:80 {\n  reverse_proxy deploy-dep-1:3000 deploy-dep-1-replica-2:3000\n}\n';
    const result = await (scalingEngine as any).getCurrentReplicas('proj-1');
    expect(result).toBe(2);
  });

  it('ignores port suffixes when counting containers', async () => {
    mockReadFileContent = 'proj-1.localhost:80 {\n  reverse_proxy a:80 b:80 c:80\n}\n';
    const result = await (scalingEngine as any).getCurrentReplicas('proj-1');
    expect(result).toBe(3);
  });
});

describe('evaluate', () => {
  beforeEach(() => {
    mockGetScalingPolicyResult = () => TEST_POLICY;
    mockListEnvVarsResult = [];
    mockReadFileContent = null;
    mockRunImpl = null;
    mockTryRunImpl = null;
  });

  it('returns early when deployment has no projectId', async () => {
    await (scalingEngine as any).evaluate({ id: 'dep-1', projectId: null, containerName: null });
  });

  it('returns early when no scaling policy', async () => {
    mockGetScalingPolicyResult = null;
    await (scalingEngine as any).evaluate(TEST_DEPLOYMENT);
  });

  it('returns early when policy is disabled', async () => {
    mockGetScalingPolicyResult = () => ({ ...TEST_POLICY, enabled: false });
    await (scalingEngine as any).evaluate(TEST_DEPLOYMENT);
  });

  it('returns early when container stats fail', async () => {
    mockRunImpl = async () => 'not-json';
    const result = await (scalingEngine as any).evaluate(TEST_DEPLOYMENT);
    expect(result).toBeUndefined();
  });

  it('sets highCpuSince on first high CPU reading', async () => {
    mockRunImpl = async () => '{"CPUPerc":"85%","MemUsage":"128MiB / 512MiB"}';
    await (scalingEngine as any).evaluate(TEST_DEPLOYMENT);
    expect(mockRedisData.highCpuSince).toBeTruthy();
  });

  it('does not scale up if highCpuSince is not old enough', async () => {
    mockRedisData = { highCpuSince: String(Date.now() - 5000), lastScaleUp: '0' };
    mockRunImpl = async () => '{"CPUPerc":"85%","MemUsage":"128MiB / 512MiB"}';
    await (scalingEngine as any).evaluate(TEST_DEPLOYMENT);
    expect(mockWriteFilePath).toBeNull();
  });

  it('scales up when CPU exceeds threshold past cooldown', async () => {
    mockGetScalingPolicyResult = () => ({ ...TEST_POLICY, cooldownSeconds: 0 });
    mockRedisData = { highCpuSince: String(Date.now() - 10000), lastScaleUp: '0' };
    mockReadFileContent = 'proj-1.localhost:80 {\n  reverse_proxy deploy-dep-1:3000\n}\n';

    mockRunImpl = async (_cmd: string, args: string[]) => {
      if (args.some(a => a.includes('stats'))) return '{"CPUPerc":"85%","MemUsage":"128MiB / 512MiB"}';
      if (args.some(a => a.includes('Image'))) return 'my-app:latest';
      if (args.some(a => a.includes('Env'))) return '["PORT=3000"]';
      if (args.some(a => a.includes('Mounts'))) return '[]';
      if (args[0] === 'run') return 'new-container-id';
      if (args[0] === 'ps') return 'caddy-abc123\n';
      if (args.some(a => a.includes('reload'))) return '';
      return '';
    };

    await (scalingEngine as any).evaluate(TEST_DEPLOYMENT);

    expect(mockWriteFilePath).toBeTruthy();
    expect(mockWriteContent).toContain('deploy-dep-1-replica-2');
  });

  it('does not scale up when already at max replicas', async () => {
    mockGetScalingPolicyResult = () => ({ ...TEST_POLICY, maxReplicas: 2, cooldownSeconds: 0 });
    mockRedisData = { highCpuSince: String(Date.now() - 10000), lastScaleUp: '0' };
    mockReadFileContent = 'proj-1.localhost:80 {\n  reverse_proxy deploy-dep-1:3000 deploy-dep-1-replica-2:3000\n}\n';
    mockRunImpl = async () => '{"CPUPerc":"85%","MemUsage":"128MiB / 512MiB"}';

    await (scalingEngine as any).evaluate(TEST_DEPLOYMENT);
    expect(mockWriteFilePath).toBeNull();
  });

  it('does not scale down when CPU is moderate', async () => {
    mockRunImpl = async () => '{"CPUPerc":"50%","MemUsage":"128MiB / 512MiB"}';
    await (scalingEngine as any).evaluate(TEST_DEPLOYMENT);
    expect(mockWriteFilePath).toBeNull();
  });

  it('scales down when CPU stays low for 5 min', async () => {
    mockGetScalingPolicyResult = () => ({ ...TEST_POLICY, minReplicas: 1, cooldownSeconds: 0 });
    mockRedisData = { lowCpuSince: String(Date.now() - 310_000), lastScaleDown: '0' };
    mockReadFileContent = 'proj-1.localhost:80 {\n  reverse_proxy deploy-dep-1:3000 deploy-dep-1-replica-2:3000\n}\n';
    mockTryRunImpl = async () => '';

    let callCount = 0;
    mockRunImpl = async (_cmd: string, args: string[]) => {
      callCount++;
      if (args.includes('stats')) return '{"CPUPerc":"5%","MemUsage":"64MiB / 512MiB"}';
      if (args[0] === 'stop') return '';
      if (args[0] === 'rm') return '';
      if (args[0] === 'ps') return 'caddy-abc123\n';
      if (args.includes('reload')) return '';
      return '';
    };

    await (scalingEngine as any).evaluate(TEST_DEPLOYMENT);

    expect(mockWriteContent).toContain('deploy-dep-1');
    expect(mockWriteContent).not.toContain('replica-2');
  });

  it('does not scale down below minReplicas', async () => {
    mockGetScalingPolicyResult = () => ({ ...TEST_POLICY, minReplicas: 2, cooldownSeconds: 0 });
    mockRedisData = { lowCpuSince: String(Date.now() - 310_000), lastScaleDown: '0' };
    mockReadFileContent = 'proj-1.localhost:80 {\n  reverse_proxy deploy-dep-1:3000 deploy-dep-1-replica-2:3000\n}\n';
    mockRunImpl = async () => '{"CPUPerc":"5%","MemUsage":"64MiB / 512MiB"}';

    await (scalingEngine as any).evaluate(TEST_DEPLOYMENT);
    expect(mockWriteFilePath).toBeNull();
  });
});
