import { lookup } from "node:dns/promises";

const isBlockedIpv4 = (ip: string): boolean => {
	const parts = ip.split(".").map(Number);
	if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
	const [a, b] = parts;
	if (a === 0 || a === 10 || a === 127) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a >= 224) return true;
	return false;
};

const isBlockedIpv6 = (ip: string): boolean => {
	const addr = ip.toLowerCase().split("%")[0];
	if (addr === "::" || addr === "::1") return true;
	if (addr.startsWith("::ffff:")) return isBlockedIpv4(addr.slice(7));
	if (/^fe[89ab]/.test(addr)) return true;
	if (/^f[cd]/.test(addr)) return true;
	if (addr.startsWith("ff")) return true;
	return false;
};

export const isBlockedAddress = (ip: string): boolean => {
	const clean = ip.replace(/^\[|\]$/g, "");
	return clean.includes(":") ? isBlockedIpv6(clean) : isBlockedIpv4(clean);
};

const PUBLIC_REQUIRED = "destination must resolve to a public address";

export const validateDestination = async (raw: string): Promise<string | null> => {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return "destination must be a valid URL";
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return "destination must use http or https";
	if (url.username || url.password) return "destination must not contain credentials";
	const hostname = url.hostname;
	if (!hostname) return "destination must be a valid URL";
	const looksLikeIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
	if (looksLikeIp && isBlockedAddress(hostname)) return PUBLIC_REQUIRED;
	let addresses: { address: string }[];
	try {
		addresses = await lookup(hostname, { all: true });
	} catch {
		return "destination hostname could not be resolved";
	}
	if (!addresses.length) return "destination hostname could not be resolved";
	if (addresses.some((entry) => isBlockedAddress(entry.address))) return PUBLIC_REQUIRED;
	return null;
};
