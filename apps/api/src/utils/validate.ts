export const SERVICE_NAME_RE = /^[a-zA-Z0-9_-]+$/;

export const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const SERVER_HOST_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$|^\[[\da-fA-F:]+\]$/;

export const isPort = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535;

const PRIVATE_HOST_RE =
	/^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|\[::1\]|0\.0\.0\.0)$/;

export const isPrivateGitUrl = (url: string): boolean => {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
		return PRIVATE_HOST_RE.test(parsed.hostname);
	} catch {
		return false;
	}
};

export interface ComposeServiceMapping {
	serviceName: string;
	subdomain?: string;
	port?: number | string;
}

export const validateComposeServiceMapping = (mapping: unknown): string | null => {
	if (!mapping || typeof mapping !== "object") {
		return "compose service mapping must be an object";
	}
	const m = mapping as ComposeServiceMapping;
	if (typeof m.serviceName !== "string" || !SERVICE_NAME_RE.test(m.serviceName)) {
		return "serviceName may only contain letters, numbers, underscores and hyphens";
	}
	if (m.subdomain !== undefined && m.subdomain !== null && m.subdomain !== "") {
		if (typeof m.subdomain !== "string" || !SUBDOMAIN_RE.test(m.subdomain)) {
			return "subdomain must be a valid hostname label (lowercase letters, numbers, hyphens)";
		}
	}
	if (m.port !== undefined && m.port !== null) {
		const port = Number(m.port);
		if (!isPort(port)) {
			return "port must be an integer between 1 and 65535";
		}
	}
	return null;
};

export const validateComposeServices = (
	value: unknown,
): { ok: true; services: ComposeServiceMapping[] } | { ok: false; error: string } => {
	let parsed: unknown = value;
	if (typeof value === "string") {
		try {
			parsed = JSON.parse(value);
		} catch {
			return { ok: false, error: "composeServices must be valid JSON" };
		}
	}
	if (!Array.isArray(parsed)) {
		return { ok: false, error: "composeServices must be an array" };
	}
	for (const mapping of parsed) {
		const err = validateComposeServiceMapping(mapping);
		if (err) return { ok: false, error: err };
	}
	return { ok: true, services: parsed as ComposeServiceMapping[] };
};
