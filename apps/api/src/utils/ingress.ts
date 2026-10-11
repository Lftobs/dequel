import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createAgentJob, getPlatformSettings, getServerById, upsertRoute } from "../db/repo";
import { CADDY_ACCESS_LOG_BLOCK, caddyReverseProxy, caddySite } from "./caddy-site";
import { config } from "./config";
import { removeRemoteCaddyRoute, syncRemoteCaddyRoute } from "./ssh";

const reloadLocalCaddy = async () => {
	const { reloadCaddy } = await import("../orchestrator/runtime");
	await reloadCaddy();
};

export interface IngressRouteInfo {
	hostname: string;
	routeFile: string;
	port: number;
	containers: string[];
}

export const getIngressServer = async () => {
	const { ingressServerId } = await getPlatformSettings();
	const resolved = ingressServerId ?? "local";
	if (resolved === "local") {
		return { id: "local", name: "Local Control Plane", mode: "local" };
	}
	return (await getServerById(resolved)) ?? { id: "local", name: "Local Control Plane", mode: "local" };
};

export const shouldRouteViaIngress = (
	projectServer: { id: string; mode: string } | null,
	ingressServer: { id: string } | null,
): boolean =>
	!!ingressServer && !!projectServer && projectServer.id !== ingressServer.id && projectServer.mode === "ssh";

export const projectServerSite = (
	hostname: string,
	port: number,
	containers: string[],
	viaIngress: boolean,
): string => {
	const targets = containers.map((c) => `${c}:${port}`).join(" ");
	const proxy = caddyReverseProxy(targets);
	if (viaIngress) {
		return caddySite(`http://${hostname}`, proxy);
	}
	return caddySite(hostname, proxy);
};

export const ingressSite = (hostname: string, upstreamHost: string): string =>
	`${hostname} {\n${CADDY_ACCESS_LOG_BLOCK}\n  reverse_proxy ${upstreamHost}:80\n}\n`;

export const syncIngressRoute = async (
	ingressServer: { id: string; mode: string },
	upstreamHost: string,
	info: IngressRouteInfo,
): Promise<void> => {
	const snippet = ingressSite(info.hostname, upstreamHost);
	if (ingressServer.mode === "ssh") {
		await syncRemoteCaddyRoute(ingressServer, info.routeFile, snippet);
		return;
	}
	if (ingressServer.mode === "agent") {
		await createAgentJob({
			deploymentId: null,
			serverId: ingressServer.id,
			type: "reload_routes",
			payload: {
				deploymentId: null,
				action: "add",
				hostname: info.hostname,
				routeFile: info.routeFile,
				port: info.port,
				targetContainers: [],
				upstreamHost,
			},
			idempotencyKey: `ingress:route:${info.hostname}:${upstreamHost}`,
		});
		return;
	}
	const routeFile = join(config.caddyRoutesDir, info.routeFile);
	await writeFile(routeFile, snippet, "utf8");
	await reloadLocalCaddy().catch(() => {});
};

export const removeIngressRouteFile = async (
	ingressServer: { id: string; mode: string },
	info: { hostname: string; routeFile: string },
): Promise<void> => {
	if (ingressServer.mode === "ssh") {
		await removeRemoteCaddyRoute(ingressServer, info.routeFile);
		return;
	}
	if (ingressServer.mode === "agent") {
		await createAgentJob({
			deploymentId: null,
			serverId: ingressServer.id,
			type: "reload_routes",
			payload: {
				deploymentId: null,
				action: "remove",
				hostname: info.hostname,
				routeFile: info.routeFile,
				port: 80,
				targetContainers: [],
			},
			idempotencyKey: `ingress:route-remove:${info.hostname}`,
		});
		return;
	}
	await rm(join(config.caddyRoutesDir, info.routeFile), { force: true }).catch(() => {});
	await reloadLocalCaddy().catch(() => {});
};

export const upsertIngressRoute = async (
	ingressServerId: string,
	projectId: string | null,
	deploymentId: string,
	upstreamHost: string,
	info: IngressRouteInfo,
): Promise<void> => {
	await upsertRoute({
		serverId: ingressServerId,
		deploymentId,
		projectId,
		hostname: info.hostname,
		routeFile: info.routeFile,
		port: info.port,
		targetContainers: info.containers,
		upstreamHost,
		status: "pending",
	});
};
