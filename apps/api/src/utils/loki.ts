import { getProjectById, listDomains } from "../db/repo";
import { config } from "./config";
import { slugify } from "./routes";

const LOKI_URL = "http://loki:3100";
const CADDY_LOG_STREAM = '{container="dequel-caddy-1"}';

export const buildProjectRequestHostRegex = async (projectId: string): Promise<string> => {
	const project = await getProjectById(projectId);
	if (!project) throw new Error(`Project ${projectId} not found`);
	const slug = slugify(project.name);
	const domains = [`${slug}.${config.caddyBaseDomain}`];
	try {
		const projectDomains = await listDomains(projectId);
		for (const d of projectDomains) {
			if (d.validationStatus === "verified") domains.push(d.domain);
		}
	} catch (err) {
		console.warn("[Loki] Failed to list domains for host regex:", err);
	}
	return domains.map((d) => d.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\\\$&")).join("|");
};

export const caddyRequestLogSelector = (hostRegex: string): string =>
	`${CADDY_LOG_STREAM} | json | request_host =~ "^(${hostRegex})$"`;

export const lokiInstantQuery = async (query: string, timeoutMs = 5000): Promise<unknown | null> => {
	const url = `${LOKI_URL}/loki/api/v1/query?query=${encodeURIComponent(query)}`;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) return null;
		const data = (await response.json()) as any;
		if (data.status !== "success") return null;
		return data.data?.result ?? null;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
};
