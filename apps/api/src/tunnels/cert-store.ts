import { X509Certificate } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export interface LoadedCert {
	cert: string;
	key: string;
}

interface CacheEntry {
	mtimeMs: number;
	notAfterMs: number;
	value: LoadedCert | null;
}

const cache = new Map<string, CacheEntry>();

const findCrtPath = async (dataDir: string, host: string): Promise<string | null> => {
	try {
		const issuers = await readdir(join(dataDir, "certificates"));
		for (const issuer of issuers) {
			const crtPath = join(dataDir, "certificates", issuer, host, `${host}.crt`);
			const st = await stat(crtPath).catch(() => null);
			if (st?.isFile()) return crtPath;
		}
	} catch {
		return null;
	}
	return null;
};

export const loadCaddyCert = async (dataDir: string, host: string, now = Date.now()): Promise<LoadedCert | null> => {
	const crtPath = await findCrtPath(dataDir, host);
	if (!crtPath) {
		cache.delete(host);
		return null;
	}
	const st = await stat(crtPath);
	const cached = cache.get(host);
	if (cached && cached.mtimeMs === st.mtimeMs && (cached.value === null || cached.notAfterMs > now + 60_000)) {
		return cached.value;
	}
	try {
		const keyPath = crtPath.replace(/\.crt$/, ".key");
		const [cert, key] = await Promise.all([readFile(crtPath, "utf8"), readFile(keyPath, "utf8")]);
		const x509 = new X509Certificate(cert);
		const notAfterMs = Date.parse(x509.validTo);
		const valid = x509.checkHost(host) && notAfterMs > now + 60_000;
		const value = valid ? { cert, key } : null;
		cache.set(host, { mtimeMs: st.mtimeMs, notAfterMs, value });
		return value;
	} catch {
		cache.delete(host);
		return null;
	}
};
