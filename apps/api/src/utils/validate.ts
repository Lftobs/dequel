export const SERVICE_NAME_RE = /^[a-zA-Z0-9_-]+$/;

export const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const isPort = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535;

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
	if (m.subdomain !== undefined && m.subdomain !== null) {
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

export const validateComposeServices = (value: unknown): { ok: true; services: ComposeServiceMapping[] } | { ok: false; error: string } => {
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
