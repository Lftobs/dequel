export type GatewayRoute = { kind: "caddy" } | { kind: "engine"; host: string; port: number };

export interface RouteRow {
	internalHost: string;
	internalPort: number;
	status: string;
	publicAccess: boolean;
	allowAnywhere: boolean;
	allowedCidrs: string[];
}

export interface RouteContext {
	baseDomain: string;
	remoteAddress: string;
	lookup: (internalHost: string) => Promise<RouteRow | null>;
}

const normalizeIp = (value: string): string => (value.startsWith("::ffff:") ? value.slice(7) : value);

const ipToLong = (ip: string): number | null => {
	const parts = ip.split(".");
	if (parts.length !== 4) return null;
	let value = 0;
	for (const part of parts) {
		const octet = Number(part);
		if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
		value = value * 256 + octet;
	}
	return value;
};

export const ipInCidr = (ip: string, cidr: string): boolean => {
	const [network, prefixRaw] = cidr.split("/");
	const prefix = Number(prefixRaw);
	const addr = ipToLong(normalizeIp(ip));
	const net = ipToLong(network ?? "");
	if (addr === null || net === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
	const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
	return (addr & mask) >>> 0 === (net & mask) >>> 0;
};

const parseDatabaseHost = (sni: string, baseDomain: string): string | null => {
	if (!sni || !baseDomain || baseDomain === "localhost") return null;
	const suffix = `.${baseDomain.toLowerCase()}`;
	const host = sni.toLowerCase();
	if (!host.endsWith(suffix)) return null;
	const candidate = host.slice(0, -suffix.length);
	if (!/^db-[a-z0-9]+$/.test(candidate)) return null;
	return candidate;
};

export const resolveGatewayRoute = async (sni: string | null, ctx: RouteContext): Promise<GatewayRoute> => {
	if (!sni) return { kind: "caddy" };
	const candidate = parseDatabaseHost(sni, ctx.baseDomain);
	if (!candidate) return { kind: "caddy" };
	const row = await ctx.lookup(candidate);
	if (!row) return { kind: "caddy" };
	if (row.status !== "running" || !row.publicAccess) return { kind: "caddy" };
	if (!row.allowAnywhere && row.allowedCidrs.length > 0) {
		const allowed = row.allowedCidrs.some((cidr) => ipInCidr(ctx.remoteAddress, cidr));
		if (!allowed) return { kind: "caddy" };
	}
	return { kind: "engine", host: row.internalHost, port: row.internalPort };
};
