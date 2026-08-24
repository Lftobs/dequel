import { mock } from 'bun:test';

const mockListIngressRoutes = mock(async () => []);
const mockGetServerById = mock(async () => null);
const mockSyncIngressRoute = mock(async () => {});
const mockRemoveIngressRouteFile = mock(async () => {});

const fileUrl = (relPath: string) => new URL(relPath, import.meta.url).toString();

mock.module(fileUrl('../../db/repo'), () => ({
  listIngressRoutes: mockListIngressRoutes,
  getServerById: mockGetServerById,
}));

mock.module(fileUrl('../../utils/ingress'), () => ({
  syncIngressRoute: mockSyncIngressRoute,
  removeIngressRouteFile: mockRemoveIngressRouteFile,
}));

const { rerenderAllIngressRoutes } = await import('../ingress-sync');

const results: any = {};

// Test 1: same server → no-op
await rerenderAllIngressRoutes('server-a', 'server-a');
results.test1 = {
  listNotCalled: !mockListIngressRoutes.mock.calls.length,
  removeNotCalled: !mockRemoveIngressRouteFile.mock.calls.length,
  syncNotCalled: !mockSyncIngressRoute.mock.calls.length,
};

mockListIngressRoutes.mockClear();
mockRemoveIngressRouteFile.mockClear();
mockSyncIngressRoute.mockClear();

// Test 2: different servers → removes from old, adds to new
mockListIngressRoutes.mockImplementation(async () => [
  { hostname: 'app1.example.com', routeFile: 'app1.caddy', port: 3000, targetContainers: ['c-1'], upstreamHost: '10.0.0.1' },
  { hostname: 'app2.example.com', routeFile: 'app2.caddy', port: 4000, targetContainers: ['c-2'], upstreamHost: '10.0.0.2' },
]);
mockGetServerById.mockImplementation(async (id: string) => ({ id, mode: 'ssh' }));

await rerenderAllIngressRoutes('server-a', 'server-b');
results.test2 = {
  removeCount: mockRemoveIngressRouteFile.mock.calls.length,
  syncCount: mockSyncIngressRoute.mock.calls.length,
};

mockListIngressRoutes.mockClear();
mockRemoveIngressRouteFile.mockClear();
mockSyncIngressRoute.mockClear();

// Test 3: new ingress is null → removes only
mockListIngressRoutes.mockImplementation(async () => [
  { hostname: 'app1.example.com', routeFile: 'app1.caddy', port: 3000, targetContainers: ['c-1'], upstreamHost: '10.0.0.1' },
]);
mockGetServerById.mockImplementation(async (id: string) => ({ id, mode: 'ssh' }));

await rerenderAllIngressRoutes('server-a', null);
results.test3 = {
  removeCount: mockRemoveIngressRouteFile.mock.calls.length,
  syncNotCalled: !mockSyncIngressRoute.mock.calls.length,
};

mockListIngressRoutes.mockClear();
mockRemoveIngressRouteFile.mockClear();
mockSyncIngressRoute.mockClear();

// Test 4: no routes → no-op
mockListIngressRoutes.mockImplementation(async () => []);
await rerenderAllIngressRoutes('server-a', 'server-b');
results.test4 = {
  removeNotCalled: !mockRemoveIngressRouteFile.mock.calls.length,
  syncNotCalled: !mockSyncIngressRoute.mock.calls.length,
};

mockListIngressRoutes.mockClear();
mockRemoveIngressRouteFile.mockClear();
mockSyncIngressRoute.mockClear();

// Test 5: error handling
mockListIngressRoutes.mockImplementation(async () => { throw new Error('db error'); });
await rerenderAllIngressRoutes('server-a', 'server-b');
results.test5 = { noThrow: true };

console.log(JSON.stringify(results));
