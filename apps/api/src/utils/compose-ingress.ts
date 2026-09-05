import { syncIngressRoute, upsertIngressRoute, removeIngressRouteFile, type IngressRouteInfo } from "./ingress";

export interface ComposeIngressHostname {
  hostname: string;
  routeFile: string;
  isPrimary: boolean;
}

export const DB_SERVICE_NAMES = new Set(["db", "postgres", "mysql", "redis", "mongo", "database"]);

export const computeComposeIngressHostnames = (
  webServices: { name: string; port: number }[],
  primaryServiceName: string,
  slug: string,
  baseDomain: string,
  customMappings: { serviceName: string; subdomain?: string }[],
): ComposeIngressHostname[] => {
  const hostnames: ComposeIngressHostname[] = [];

  hostnames.push({
    hostname: `${slug}.${baseDomain}`,
    routeFile: `${slug}.caddy`,
    isPrimary: true,
  });

  const seen = new Set<string>();

  for (const svc of webServices) {
    if (svc.name === primaryServiceName) continue;

    const customMatch = customMappings.find((c) => c.serviceName === svc.name);
    if (!customMatch && DB_SERVICE_NAMES.has(svc.name)) continue;

    const subdomainPrefix = customMatch?.subdomain?.trim() || svc.name;

    const primaryHostname = `${subdomainPrefix}.${slug}.${baseDomain}`;
    if (!seen.has(primaryHostname)) {
      seen.add(primaryHostname);
      hostnames.push({
        hostname: primaryHostname,
        routeFile: `${subdomainPrefix}-${slug}.caddy`,
        isPrimary: false,
      });
    }

    if (svc.name === "server" && !customMatch?.subdomain?.trim()) {
      const apiHostname = `api.${slug}.${baseDomain}`;
      if (!seen.has(apiHostname)) {
        seen.add(apiHostname);
        hostnames.push({
          hostname: apiHostname,
          routeFile: `api-${slug}.caddy`,
          isPrimary: false,
        });
      }
    }
  }

  return hostnames;
};

export const syncComposeIngressRoutes = async (
  ingressServer: { id: string; mode: string },
  workerServer: { id: string; host: string; mode: string },
  deployment: { id: string; projectId: string | null },
  project: { id: string | null },
  hostnames: ComposeIngressHostname[],
): Promise<void> => {
  for (const entry of hostnames) {
    const routeInfo: IngressRouteInfo = {
      hostname: entry.hostname,
      routeFile: entry.routeFile,
      port: 80,
      containers: [],
    };

    await syncIngressRoute(ingressServer, workerServer.host, routeInfo);
    await upsertIngressRoute(
      ingressServer.id,
      project.id,
      deployment.id,
      workerServer.host,
      routeInfo,
    );
  }
};

export const removeComposeIngressRoutes = async (
  ingressServer: { id: string; mode: string },
  deploymentId: string,
): Promise<void> => {
  const { listRoutesByDeployment } = await import("../db/repo");
  const depRoutes = await listRoutesByDeployment(deploymentId);
  for (const route of depRoutes) {
    if (route.upstreamHost) {
      await removeIngressRouteFile(ingressServer, {
        hostname: route.hostname,
        routeFile: route.routeFile,
      });
    }
  }
};
