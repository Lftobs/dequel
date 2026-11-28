import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getProjectById, getServerById, listDeployments, upsertRoute } from "../db/repo";
import { config } from "../utils/config";
import { buildCaddySnippet } from "../utils/domain-verifier";
import { getIngressServer, shouldRouteViaIngress } from "../utils/ingress";
import { baseDomainFor, slugify } from "../utils/routes";
import { syncRemoteCaddyRoute } from "../utils/ssh";
import { reloadCaddy } from "./runtime";

export type RouteReconcileResult = {
	applied: boolean;
	reason?: string;
};

const ROUTE_ASSET_REFERENCE = /\/etc\/caddy\/routes\/([A-Za-z0-9._-]+)/g;

export const extractRouteAssets = (snippet: string): string[] => {
	const assets = new Set<string>();
	for (const match of snippet.matchAll(ROUTE_ASSET_REFERENCE)) {
		assets.add(match[1]);
	}
	return [...assets];
};

export const reconcileProjectRoute = async (projectId: string): Promise<RouteReconcileResult> => {
	const project = await getProjectById(projectId);
	if (!project) return { applied: false, reason: "project not found" };

	const active = (await listDeployments(projectId)).find((d) => d.status === "running" && d.containerName);
	if (!active?.containerName) return { applied: false, reason: "no running deployment" };

	const server = active.serverId && active.serverId !== "local" ? await getServerById(active.serverId) : null;
	const mode = server?.mode ?? "local";

	if (mode === "agent") {
		return { applied: false, reason: "agent routes are applied on the next deployment" };
	}
	if (shouldRouteViaIngress(server, await getIngressServer())) {
		return { applied: false, reason: "ingress-managed routes are applied on the next deployment" };
	}

	const slug = slugify(project.name || projectId);
	const routeFile = `${slug}.caddy`;
	const snippet = await buildCaddySnippet(slug, active.containerName, projectId, undefined, project.port ?? undefined);
	const assets = extractRouteAssets(snippet);

	if (mode === "ssh" || mode === "docker_tcp") {
		if (!server) return { applied: false, reason: "deployment server not found" };
		await syncRemoteCaddyRoute(server, routeFile, snippet, assets);
	} else {
		await writeFile(join(config.caddyRoutesDir, routeFile), snippet, "utf8");
		await reloadCaddy();
	}

	await upsertRoute({
		serverId: mode === "local" ? "local" : server!.id,
		deploymentId: active.id,
		projectId,
		hostname: `${slug}.${baseDomainFor()}`,
		routeFile,
		port: project.port ?? config.appInternalPort,
		targetContainers: [active.containerName],
		status: "active",
	});

	return { applied: true };
};
