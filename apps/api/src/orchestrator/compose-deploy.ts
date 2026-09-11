import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../utils/config";
import { dockerBin } from "../utils/docker-bin";
import { buildCaddySnippet } from "../utils/domain-verifier";
import { deployWithCompose, destroyComposeStack, getComposeContainerNames, parseAllComposeServices } from "./compose";
import { reloadCaddy, tryRun } from "./runtime";

export interface ComposeDeployResult {
	containerName: string;
	liveUrl: string;
}

export interface ComposeDeployOptions {
	workspacePath: string;
	deploymentId: string;
	projectId: string;
	projectName: string;
	sourceDir?: string | null;
	composeService?: string | null;
	composePort?: number | null;
	composeServicesJson?: string | null;
	oldDeploymentId?: string | null;
	envVars?: Record<string, string>;
	signal?: AbortSignal;
	onLog: (line: string) => Promise<void>;
}

export const deployComposeStack = async (options: ComposeDeployOptions): Promise<ComposeDeployResult> => {
	const {
		workspacePath,
		deploymentId,
		projectId,
		projectName,
		sourceDir,
		composeService,
		composePort,
		composeServicesJson,
		oldDeploymentId,
		envVars,
		signal,
		onLog,
	} = options;

	if (oldDeploymentId) {
		await onLog(`Stopping previous compose stack deploy-${oldDeploymentId}`);
		await destroyComposeStack(`deploy-${oldDeploymentId}`);
	}

	await deployWithCompose(workspacePath, `deploy-${deploymentId}`, onLog, sourceDir, envVars, signal);

	const allServices = parseAllComposeServices(workspacePath, sourceDir, composeService, composePort);

	const composeContainers = await getComposeContainerNames(`deploy-${deploymentId}`);
	const containerFor = (serviceName: string) =>
		composeContainers.get(serviceName) || `deploy-${deploymentId}-${serviceName}-1`;

	for (const s of allServices) {
		const cName = containerFor(s.serviceName);
		await tryRun(dockerBin, ["network", "connect", config.dockerNetwork, cName]);
	}

	const target = allServices.find((s) => s.isPrimary) || allServices[0];
	const containerName = containerFor(target.serviceName);

	const slug = projectName
		? projectName
				.toLowerCase()
				.replace(/[^a-z0-9-]+/g, "-")
				.replace(/^-+|-+$/g, "")
				.slice(0, 63)
		: projectId;

	let snippet = await buildCaddySnippet(slug, containerName, projectId, undefined, target.port);

	const rawBaseDomain = config.caddyBaseDomain || "localhost";
	const baseDomainForCaddy = rawBaseDomain === "localhost" ? `${rawBaseDomain}:80` : rawBaseDomain;
	let customMappings: { serviceName: string; port: number | string; subdomain?: string }[] = [];
	if (composeServicesJson) {
		try {
			customMappings = JSON.parse(composeServicesJson);
		} catch (_e) {}
	}

	for (const s of allServices) {
		if (s.isPrimary) continue;
		const sContainer = containerFor(s.serviceName);
		const customMatch = customMappings.find((c) => c.serviceName === s.serviceName);
		const domains: string[] = [];
		if (customMatch?.subdomain?.trim()) {
			domains.push(`${customMatch.subdomain.trim()}.${slug}.${baseDomainForCaddy}`);
		} else {
			domains.push(`${s.serviceName}.${slug}.${baseDomainForCaddy}`);
			if (s.serviceName === "server" && !domains.includes(`api.${slug}.${baseDomainForCaddy}`)) {
				domains.push(`api.${slug}.${baseDomainForCaddy}`);
			}
		}
		const targetPort = customMatch?.port ? Number(customMatch.port) : s.port;
		snippet += `\n${domains.join(", ")} {\n  log {\n    output stdout\n    format json\n  }\n  reverse_proxy ${sContainer}:${targetPort} {\n    header_up Host {upstream_hostport}\n  }\n}\n`;
	}

	const caddyRouteFile = join(config.caddyRoutesDir, `${slug}.caddy`);
	await writeFile(caddyRouteFile, snippet, "utf8");
	try {
		await reloadCaddy();
	} catch {
		console.warn("[Pipeline] Caddy not ready for reload after compose deploy");
	}

	const liveUrl = rawBaseDomain === "localhost" ? `http://${slug}.localhost` : `https://${slug}.${rawBaseDomain}`;

	return { containerName, liveUrl };
};
