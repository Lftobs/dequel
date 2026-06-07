import { describe, it, expect, mock, beforeAll, afterAll, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tmpDir: string;
let routesDir: string;
const testConfig = { caddyRoutesDir: '', appInternalPort: 3000 };

const fileUrl = (path: string) => new URL(path, import.meta.url).toString();
mock.module(fileUrl('../config'), () => ({ config: testConfig }));
mock.module(fileUrl('../../orchestrator/runtime'), () => ({
  reloadCaddy: mock(() => Promise.resolve()),
}));

let module: typeof import('../domain-verifier');

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'domain-verifier-test-'));
  routesDir = join(tmpDir, 'routes');
  mkdirSync(routesDir, { recursive: true });
  testConfig.caddyRoutesDir = routesDir;
  module = await import('../domain-verifier');
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function createRouteFile(slug: string, content: string) {
  writeFileSync(join(routesDir, `${slug}.caddy`), content, 'utf8');
}

function readRouteFile(slug: string): string {
  return readFileSync(join(routesDir, `${slug}.caddy`), 'utf8');
}

function routeFileExists(slug: string): boolean {
  return existsSync(join(routesDir, `${slug}.caddy`));
}

describe('addToCaddyRoute', () => {
  afterEach(() => {
    const files = ['elysia', 'test-project', 'no-match', 'my-project', 'other'];
    for (const f of files) {
      const p = join(routesDir, `${f}.caddy`);
      if (existsSync(p)) rmSync(p);
    }
  });

  it('adds domain with :80 to existing route file', async () => {
    createRouteFile('elysia', 'elysia.localhost:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
    await module.addToCaddyRoute('app.example.com', 'proj-1', 'elysia');
    const content = readRouteFile('elysia');
    expect(content).toBe('elysia.localhost:80, app.example.com:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
  });

  it('is idempotent (does not add duplicate domain)', async () => {
    createRouteFile('elysia', 'elysia.localhost:80, app.example.com:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
    await module.addToCaddyRoute('app.example.com', 'proj-1', 'elysia');
    const content = readRouteFile('elysia');
    expect(content).toBe('elysia.localhost:80, app.example.com:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
  });

  it('does nothing when route file does not exist', async () => {
    await module.addToCaddyRoute('app.example.com', 'proj-2', 'nonexistent');
    expect(routeFileExists('nonexistent')).toBe(false);
  });

  it('does nothing when route file has no site block', async () => {
    createRouteFile('test-project', '# just a comment\n');
    await module.addToCaddyRoute('app.example.com', 'proj-3', 'test-project');
    const content = readRouteFile('test-project');
    expect(content).toBe('# just a comment\n');
  });

  it('handles multiple domains correctly', async () => {
    createRouteFile('elysia', 'elysia.localhost:80, first.com:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
    await module.addToCaddyRoute('second.com', 'proj-1', 'elysia');
    const content = readRouteFile('elysia');
    expect(content).toBe('elysia.localhost:80, first.com:80, second.com:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
  });

  it('uses project name as slug for file path', async () => {
    createRouteFile('my-project', 'my-project.localhost:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
    await module.addToCaddyRoute('app.example.com', 'proj-4', 'My Project');
    const content = readRouteFile('my-project');
    expect(content).toContain('app.example.com:80');
  });
});

describe('removeFromCaddyRoute', () => {
  afterEach(() => {
    const p = join(routesDir, 'elysia.caddy');
    if (existsSync(p)) rmSync(p);
  });

  it('removes domain from route file', async () => {
    createRouteFile('elysia', 'elysia.localhost:80, app.example.com:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
    await module.removeFromCaddyRoute('app.example.com', 'proj-1', 'elysia');
    const content = readRouteFile('elysia');
    expect(content).toBe('elysia.localhost:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
  });

  it('removes domain from middle of domain list', async () => {
    createRouteFile('elysia', 'elysia.localhost:80, first.com:80, second.com:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
    await module.removeFromCaddyRoute('first.com', 'proj-1', 'elysia');
    const content = readRouteFile('elysia');
    expect(content).toBe('elysia.localhost:80, second.com:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
  });

  it('does nothing when domain is not in the file', async () => {
    createRouteFile('elysia', 'elysia.localhost:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
    await module.removeFromCaddyRoute('not-there.com', 'proj-1', 'elysia');
    const content = readRouteFile('elysia');
    expect(content).toBe('elysia.localhost:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
  });

  it('does nothing when file does not exist', async () => {
    await module.removeFromCaddyRoute('app.example.com', 'proj-2', 'nonexistent');
    expect(routeFileExists('nonexistent')).toBe(false);
  });

  it('handles removal when domain exists without :80 suffix (backward compat)', async () => {
    createRouteFile('elysia', 'elysia.localhost:80, app.example.com {\n  reverse_proxy deploy-abc:3000\n}\n');
    await module.removeFromCaddyRoute('app.example.com', 'proj-1', 'elysia');
    const content = readRouteFile('elysia');
    expect(content).toBe('elysia.localhost:80 {\n  reverse_proxy deploy-abc:3000\n}\n');
  });
});

describe('buildCaddySnippet', () => {
  const noDomains = mock().mockResolvedValue([]);
  const mockDomains = (domains: string[]) =>
    mock().mockResolvedValue(
      domains.map((d) => ({
        id: d,
        projectId: 'proj-1',
        domain: d,
        type: 'custom' as const,
        validationStatus: 'verified' as const,
        sslStatus: 'provisioned' as const,
        createdAt: '',
        updatedAt: '',
      })),
    );

  afterEach(() => {
    noDomains.mockClear();
  });

  it('creates snippet with just localhost domain when no verified domains', async () => {
    const snippet = await module.buildCaddySnippet('elysia', 'deploy-abc', 'proj-1', noDomains);
    expect(snippet).toBe('elysia.localhost:80 {\n  log {\n    output stdout\n    format json\n  }\n  reverse_proxy deploy-abc:3000\n}\n');
  });

  it('creates snippet with verified domains when projectId is provided', async () => {
    const listFn = mockDomains(['app.example.com']);
    const snippet = await module.buildCaddySnippet('elysia', 'deploy-abc', 'proj-1', listFn);
    expect(snippet).toBe('elysia.localhost:80, app.example.com:80 {\n  log {\n    output stdout\n    format json\n  }\n  reverse_proxy deploy-abc:3000\n}\n');
  });

  it('only includes verified (not pending) domains', async () => {
    const listFn = mock().mockResolvedValue([
      { id: '1', projectId: 'proj-1', domain: 'verified.com', type: 'custom', validationStatus: 'verified', sslStatus: 'provisioned', createdAt: '', updatedAt: '' },
      { id: '2', projectId: 'proj-1', domain: 'pending.com', type: 'custom', validationStatus: 'pending', sslStatus: 'pending', createdAt: '', updatedAt: '' },
    ]);
    const snippet = await module.buildCaddySnippet('elysia', 'deploy-abc', 'proj-1', listFn);
    expect(snippet).toContain('verified.com:80');
    expect(snippet).not.toContain('pending.com');
  });

  it('does not duplicate domains', async () => {
    const listFn = mockDomains(['app.example.com']);
    const snippet = await module.buildCaddySnippet('elysia', 'deploy-abc', 'proj-1', listFn);
    const matches = snippet.match(/app\.example\.com/g);
    expect(matches).toHaveLength(1);
  });

  it('sets reverse_proxy target correctly', async () => {
    const snippet = await module.buildCaddySnippet('my-app', 'deploy-xyz-123', 'proj-2', noDomains);
    expect(snippet).toContain('reverse_proxy deploy-xyz-123:3000');
  });

  it('uses config.appInternalPort as proxy port', async () => {
    const snippet = await module.buildCaddySnippet('my-app', 'deploy-abc', 'proj-3', noDomains);
    expect(snippet).toContain(':3000');
  });
});
