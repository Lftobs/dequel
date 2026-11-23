import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/db-provider";
import {
	getDomainSecrets,
	getProjectById,
	listDomains,
	listEnvironmentVariablesForDeploy,
	updateDomainValidation,
} from "../db/repo";
import { domains } from "../db/schema";
import { reloadCaddy } from "../orchestrator/runtime";
import { caddyReverseProxy, caddySite } from "./caddy-site";
import { isCloudflareProxied, isGlobalCloudflareProxied } from "./cloudflare";
import { config } from "./config";
import { resolveServerIp, validateDomain } from "./dns";

const POLL_INTERVAL = 30_000;

const slugify = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 63);

let handle: ReturnType<typeof setInterval> | null = null;

export const startDomainPolling = () => {
	if (handle) return;
	poll();
	reconcileVerifiedDomains();
	handle = setInterval(poll, POLL_INTERVAL);
};

export const stopDomainPolling = () => {
	if (handle) {
		clearInterval(handle);
		handle = null;
	}
};

const reconcileVerifiedDomains = async () => {
	try {
		const db = await getDb();
		const rows = await db
			.select({
				id: domains.id,
				projectId: domains.projectId,
				domain: domains.domain,
			})
			.from(domains)
			.where(eq(domains.validationStatus, "verified"))
			.execute();
		for (const row of rows) {
			try {
				const project = await getProjectById(row.projectId);
				await addToCaddyRoute(row.domain, row.projectId, project?.name ?? "");
			} catch (e) {
				console.error(`Caddy reconciliation failed for ${row.domain}:`, e);
			}
		}
	} catch (e) {
		console.error("Caddy reconciliation failed:", e);
	}
};

const poll = async () => {
	try {
		const db = await getDb();
		const rows = await db
			.select({
				id: domains.id,
				projectId: domains.projectId,
				domain: domains.domain,
			})
			.from(domains)
			.where(sql`${domains.validationStatus} IN ('pending', 'failed')`)
			.execute();
		if (!rows.length) return;

		const serverIp = await resolveServerIp();
		if (!serverIp) return;

		for (const row of rows) {
			try {
				const project = await getProjectById(row.projectId);
				const valid = await validateDomain(row.domain, serverIp, project?.baseDomain);
				if (valid) {
					await updateDomainValidation(row.id, "verified", "provisioned");
					await addToCaddyRoute(row.domain, row.projectId, project?.name ?? "");
				}
			} catch (e) {
				console.error(`Domain verification failed for ${row.domain}:`, e);
			}
		}
	} catch (e) {
		console.error("Domain polling failed:", e);
	}
};

export interface CaddyRouteOpts {
	routesDir?: string;
	reloadFn?: () => Promise<void>;
}

export const addToCaddyRoute = async (
	domain: string,
	projectId: string,
	projectName: string,
	opts?: CaddyRouteOpts,
) => {
	const routesDir = opts?.routesDir ?? config.caddyRoutesDir;
	const reloadFn = opts?.reloadFn ?? reloadCaddy;
	const slug = slugify(projectName || projectId);
	const filePath = join(routesDir, `${slug}.caddy`);

	try {
		let content = readFileSync(filePath, "utf8");
		const idx = content.indexOf(" {\n");
		if (idx === -1) return;

		const firstLine = content.slice(0, idx);
		if (firstLine.includes(domain)) return;

		const entry = domain.includes("localhost") ? `${domain}:80` : domain;
		content = `${firstLine}, ${entry}${content.slice(idx)}`;
		writeFileSync(filePath, content, "utf8");
		await reloadFn();
	} catch (e) {
		console.warn(
			`Could not add ${domain} to Caddy route (deploy the project first):`,
			e instanceof Error ? e.message : e,
		);
	}
};

export const removeFromCaddyRoute = async (
	domain: string,
	projectId: string,
	projectName: string,
	opts?: CaddyRouteOpts,
) => {
	const routesDir = opts?.routesDir ?? config.caddyRoutesDir;
	const reloadFn = opts?.reloadFn ?? reloadCaddy;
	const slug = slugify(projectName || projectId);
	const filePath = join(routesDir, `${slug}.caddy`);

	try {
		let content = readFileSync(filePath, "utf8");
		const idx = content.indexOf(" {\n");
		if (idx === -1) return;

		const firstLine = content.slice(0, idx);
		if (!firstLine.includes(domain)) return;

		const ports = [":80", ":443", ""];
		let replaced = false;
		for (const port of ports) {
			const needle = `, ${domain}${port}`;
			if (firstLine.includes(needle)) {
				content = content.replace(needle, "");
				replaced = true;
				break;
			}
		}
		if (!replaced) {
			const bare = domain;
			if (firstLine.includes(bare)) {
				content = content.replace(bare, "");
			}
		}
		writeFileSync(filePath, content, "utf8");
		await reloadFn();
	} catch {
		// Caddy file doesn't exist yet
	}
};

export interface BuildSnippetOpts {
	baseDomain?: string;
	listEnvVarsFn?: typeof listEnvironmentVariablesForDeploy;
	containerNames?: string[];
}

export const buildCaddySnippet = async (
	slug: string,
	containerName: string,
	projectId?: string,
	listDomainsFn: typeof listDomains = listDomains,
	appPort?: number,
	opts?: BuildSnippetOpts,
): Promise<string> => {
	const routesDir = config.caddyRoutesDir;
	const baseDomainRaw = opts?.baseDomain ?? config.caddyBaseDomain;
	const baseDomain = baseDomainRaw === "localhost" ? `${baseDomainRaw}:80` : baseDomainRaw;
	const listEnvVars = opts?.listEnvVarsFn ?? listEnvironmentVariablesForDeploy;
	let defaultDomains = [`${slug}.${baseDomain}`];
	let port = appPort ?? config.appInternalPort;
	const isBaseProxied = isGlobalCloudflareProxied();
	const customBlocks: string[] = [];
	const project = projectId ? await getProjectById(projectId).catch(() => null) : null;

	if (projectId) {
		const projectDomains = await listDomainsFn(projectId);
		const verified = projectDomains.filter((d) => d.validationStatus === "verified");
		for (const d of verified) {
			const entryDomain = d.domain.includes("localhost") ? `${d.domain}:80` : d.domain;
			const isProxied = isCloudflareProxied((d as any).cloudflareProxied);
			const hasAdvanced =
				Boolean(d.targetService || d.targetPort || isProxied !== isBaseProxied) ||
				d.tlsMode === "custom" ||
				d.tlsMode === "dns" ||
				Boolean(d.basicAuthUser) ||
				d.httpsRedirect === false ||
				d.gzip === false ||
				Boolean(d.noindex) ||
				Boolean(d.wwwRedirect) ||
				Boolean(d.pathPrefix) ||
				Boolean(d.rawSnippet);
			if (!hasAdvanced) {
				if (!defaultDomains.includes(entryDomain)) defaultDomains.push(entryDomain);
				continue;
			}
			let targetContainer = containerName;
			if (d.targetService) {
				const parts = containerName.split("-");
				if (parts.length >= 3) {
					parts[parts.length - 2] = d.targetService;
					targetContainer = parts.join("-");
				}
			}
			const tPort = d.targetPort || port;
			const needsSecrets = d.tlsMode === "custom" || Boolean(d.basicAuthUser);
			const secrets = needsSecrets
				? await getDomainSecrets(d.id).catch(() => ({
						certificate: null,
						certificateKey: null,
						basicAuthPassword: null,
					}))
				: { certificate: null, certificateKey: null, basicAuthPassword: null };
			let certificatePath: string | null = null;
			let certificateKeyPath: string | null = null;
			if (d.tlsMode === "custom" && secrets.certificate && secrets.certificateKey) {
				const safeName = d.domain.replace(/[^a-z0-9.-]/gi, "_");
				certificatePath = `/etc/caddy/routes/${safeName}.crt`;
				certificateKeyPath = `/etc/caddy/routes/${safeName}.key`;
				try {
					writeFileSync(join(routesDir, `${safeName}.crt`), secrets.certificate, { mode: 0o600 });
					writeFileSync(join(routesDir, `${safeName}.key`), secrets.certificateKey, { mode: 0o600 });
				} catch (error) {
					console.warn(`Could not write certificate files for ${d.domain}:`, error);
				}
			}
			const basicAuth =
				d.basicAuthUser && secrets.basicAuthPassword
					? {
							username: d.basicAuthUser,
							passwordHash: await Bun.password.hash(secrets.basicAuthPassword, { algorithm: "bcrypt" }),
						}
					: null;
			const maintenance = project?.maintenanceEnabled
				? `  respond "${(project.maintenanceMessage || "Service temporarily unavailable").replace(/"/g, '\\"')}" 503`
				: caddyReverseProxy(`${targetContainer}:${tPort}`, { cloudflareProxied: isProxied });
			const reverseProxy = d.pathPrefix
				? `  handle_path ${d.stripPrefix ? `${d.pathPrefix}/*` : `${d.pathPrefix}*`} {\n${maintenance
						.split("\n")
						.map((line) => `    ${line.trimStart()}`)
						.join("\n")}\n  }`
				: maintenance;
			customBlocks.push(
				caddySite(entryDomain, reverseProxy, {
					tlsMode: d.tlsMode as any,
					certificatePath,
					certificateKeyPath,
					basicAuth,
					httpsRedirect: d.httpsRedirect,
					gzip: d.gzip,
					noindex: d.noindex,
					rawSnippet: d.rawSnippet,
				}),
			);
			if (d.wwwRedirect) {
				customBlocks.push(
					caddySite(`www.${entryDomain}`, `  redir https://${entryDomain}{uri} permanent`, {
						tlsMode: d.tlsMode as any,
						certificatePath,
						certificateKeyPath,
					}),
				);
			}
		}

		try {
			const envVars = await listEnvVars(projectId);
			const portVar = envVars.find((v) => v.key === "PORT");
			if (portVar?.value && !appPort) {
				const parsedPort = Number(portVar.value);
				if (!Number.isNaN(parsedPort) && parsedPort > 0) {
					port = parsedPort;
				}
			}
		} catch (e) {
			console.warn(`Could not read environment variables for Caddy snippet for project ${projectId}:`, e);
		}
	}

	if (defaultDomains.length === 0 || defaultDomains.every((d) => !d.trim())) {
		defaultDomains = [`${slug}.${baseDomain}`];
	}

	const allDomains = [
		...defaultDomains,
		...customBlocks.flatMap((b) => {
			const m = b.match(/^([^\n{]+?)\s*\{/);
			return m ? m[1].split(",").map((d) => d.trim()) : [];
		}),
	];
	for (const d of allDomains) {
		if (/^:\d+$/.test(d)) {
			console.error(`buildCaddySnippet: rejected bare catch-all domain "${d}" — falling back to ${slug}.${baseDomain}`);
			defaultDomains = [`${slug}.${baseDomain}`];
			break;
		}
	}

	const upstreamNames = opts?.containerNames?.length ? opts.containerNames : [containerName];
	const upstreams = upstreamNames.map((n) => `${n}:${port}`).join(" ");
	const primaryReverseProxy = project?.maintenanceEnabled
		? `  respond "${(project.maintenanceMessage || "Service temporarily unavailable").replace(/"/g, '\\"')}" 503`
		: caddyReverseProxy(upstreams, { cloudflareProxied: isBaseProxied });
	const primaryBlock = caddySite(defaultDomains.join(", "), primaryReverseProxy);

	return [primaryBlock, ...customBlocks].join("\n");
};
