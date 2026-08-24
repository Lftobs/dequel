import { listIngressRoutes } from "../db/repo";
import { getServerById } from "../db/repo";
import { syncIngressRoute, removeIngressRouteFile, type IngressRouteInfo } from "../utils/ingress";

export const rerenderAllIngressRoutes = async (
  oldIngressServerId: string | null,
  newIngressServerId: string | null,
): Promise<void> => {
  if (oldIngressServerId === newIngressServerId) return;

  try {
    const routes = await listIngressRoutes();
    if (routes.length === 0) return;

    if (oldIngressServerId) {
      const oldServer = await getServerById(oldIngressServerId);
      if (oldServer) {
        for (const route of routes) {
          try {
            await removeIngressRouteFile(oldServer, {
              hostname: route.hostname,
              routeFile: route.routeFile,
            });
          } catch (err) {
            console.error(`Failed to remove ingress route ${route.hostname} from server ${oldIngressServerId}:`, err);
          }
        }
      }
    }

    if (newIngressServerId) {
      const newServer = await getServerById(newIngressServerId);
      if (newServer) {
        for (const route of routes) {
          try {
            const info: IngressRouteInfo = {
              hostname: route.hostname,
              routeFile: route.routeFile,
              port: route.port,
              containers: (route.targetContainers as string[]) ?? [],
            };
            await syncIngressRoute(newServer, route.upstreamHost!, info);
          } catch (err) {
            console.error(`Failed to sync ingress route ${route.hostname} to server ${newIngressServerId}:`, err);
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to re-render ingress routes:", err);
  }
};
