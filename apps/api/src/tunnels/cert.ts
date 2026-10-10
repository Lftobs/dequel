import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface GatewayCert {
	key: string;
	cert: string;
}

const CERT_FILE = "gateway-cert.pem";
const KEY_FILE = "gateway-key.pem";

const generate = async (dir: string): Promise<GatewayCert> => {
	const keyPath = join(dir, KEY_FILE);
	const certPath = join(dir, CERT_FILE);
	await run("openssl", [
		"req",
		"-x509",
		"-newkey",
		"rsa:2048",
		"-nodes",
		"-days",
		"3650",
		"-keyout",
		keyPath,
		"-out",
		certPath,
		"-subj",
		"/CN=dequel-gateway",
	]);
	return { key: await readFile(keyPath, "utf8"), cert: await readFile(certPath, "utf8") };
};

export const loadOrCreateGatewayCert = async (dir: string): Promise<GatewayCert> => {
	try {
		const [key, cert] = await Promise.all([
			readFile(join(dir, KEY_FILE), "utf8"),
			readFile(join(dir, CERT_FILE), "utf8"),
		]);
		if (key.trim() && cert.trim()) return { key, cert };
	} catch {
		// fall through to generation
	}
	await mkdir(dir, { recursive: true });
	return generate(dir);
};

export const persistGatewayCert = async (dir: string, cert: GatewayCert): Promise<void> => {
	await mkdir(dir, { recursive: true });
	await Promise.all([
		writeFile(join(dir, KEY_FILE), cert.key, { mode: 0o600 }),
		writeFile(join(dir, CERT_FILE), cert.cert),
	]);
};
