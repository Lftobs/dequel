import { describe, it, expect, mock, beforeEach } from 'bun:test';

const fileUrl = (relPath: string) => new URL(relPath, import.meta.url).toString();

const mockListIngressRoutes = mock(async () => []);
const mockGetServerById = mock(async () => null);
const mockSyncIngressRoute = mock(async () => {});
const mockRemoveIngressRouteFile = mock(async () => {});

beforeEach(() => {
  mockListIngressRoutes.mockClear();
  mockGetServerById.mockClear();
  mockSyncIngressRoute.mockClear();
  mockRemoveIngressRouteFile.mockClear();
});

mock.module(fileUrl('../../db/repo'), () => ({
  listIngressRoutes: mockListIngressRoutes,
  getServerById: mockGetServerById,
}));

mock.module(fileUrl('../../utils/ingress'), () => ({
  syncIngressRoute: mockSyncIngressRoute,
  removeIngressRouteFile: mockRemoveIngressRouteFile,
}));

const { rerenderAllIngressRoutes } = await import('../ingress-sync');

describe('rerenderAllIngressRoutes', () => {
  it('does nothing when old and new ingress server are the same', async () => {
    await rerenderAllIngressRoutes('server-a', 'server-a');

    expect(mockListIngressRoutes).not.toHaveBeenCalled();
    expect(mockRemoveIngressRouteFile).not.toHaveBeenCalled();
    expect(mockSyncIngressRoute).not.toHaveBeenCalled();
  });

  it('removes routes from old server and adds to new server', async () => {
    const routes = [
      { hostname: 'app1.example.com', routeFile: 'app1.caddy', port: 3000, targetContainers: ['c-1'], upstreamHost: '10.0.0.1' },
      { hostname: 'app2.example.com', routeFile: 'app2.caddy', port: 4000, targetContainers: ['c-2'], upstreamHost: '10.0.0.2' },
    ];
    mockListIngressRoutes.mockImplementation(async () => routes);
    mockGetServerById.mockImplementation(async (id: string) => ({ id, mode: 'ssh' }));

    await rerenderAllIngressRoutes('server-a', 'server-b');

    expect(mockRemoveIngressRouteFile).toHaveBeenCalledTimes(2);
    expect(mockRemoveIngressRouteFile).toHaveBeenCalledWith(
      { id: 'server-a', mode: 'ssh' },
      { hostname: 'app1.example.com', routeFile: 'app1.caddy' },
    );
    expect(mockRemoveIngressRouteFile).toHaveBeenCalledWith(
      { id: 'server-a', mode: 'ssh' },
      { hostname: 'app2.example.com', routeFile: 'app2.caddy' },
    );

    expect(mockSyncIngressRoute).toHaveBeenCalledTimes(2);
    expect(mockSyncIngressRoute).toHaveBeenCalledWith(
      { id: 'server-b', mode: 'ssh' },
      '10.0.0.1',
      { hostname: 'app1.example.com', routeFile: 'app1.caddy', port: 3000, containers: ['c-1'] },
    );
    expect(mockSyncIngressRoute).toHaveBeenCalledWith(
      { id: 'server-b', mode: 'ssh' },
      '10.0.0.2',
      { hostname: 'app2.example.com', routeFile: 'app2.caddy', port: 4000, containers: ['c-2'] },
    );
  });

  it('removes routes from old server when new ingress is null', async () => {
    const routes = [
      { hostname: 'app1.example.com', routeFile: 'app1.caddy', port: 3000, targetContainers: ['c-1'], upstreamHost: '10.0.0.1' },
    ];
    mockListIngressRoutes.mockImplementation(async () => routes);
    mockGetServerById.mockImplementation(async (id: string) => ({ id, mode: 'ssh' }));

    await rerenderAllIngressRoutes('server-a', null);

    expect(mockRemoveIngressRouteFile).toHaveBeenCalledTimes(1);
    expect(mockRemoveIngressRouteFile).toHaveBeenCalledWith(
      { id: 'server-a', mode: 'ssh' },
      { hostname: 'app1.example.com', routeFile: 'app1.caddy' },
    );
    expect(mockSyncIngressRoute).not.toHaveBeenCalled();
  });

  it('does nothing when there are no ingress routes', async () => {
    mockListIngressRoutes.mockImplementation(async () => []);

    await rerenderAllIngressRoutes('server-a', 'server-b');

    expect(mockRemoveIngressRouteFile).not.toHaveBeenCalled();
    expect(mockSyncIngressRoute).not.toHaveBeenCalled();
  });

  it('handles errors gracefully without throwing', async () => {
    mockListIngressRoutes.mockImplementation(async () => {
      throw new Error('db error');
    });

    await expect(rerenderAllIngressRoutes('server-a', 'server-b')).resolves.toBeUndefined();
  });
});
