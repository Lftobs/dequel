import type { AddressInfo } from "node:net";
import { connect, createServer, type Socket } from "node:net";
import { createServer as createTlsServer, type ServerOptions } from "node:tls";
import { Pool } from "pg";
import { config } from "../utils/config";
import { decryptValue } from "../utils/crypto";
import { type GatewayCert, loadOrCreateGatewayCert } from "./cert";
import { parseClientHello, parsePostgresPreamble, readClientHello } from "./peek";
import { type GatewayRoute, type RouteRow, resolveGatewayRoute } from "./routes";
import { forwardViaSsh, type SshEngineTarget } from "./ssh-tunnel";

export interface GatewayOptions {
	port: number;
	baseDomain: string;
	caddyHost: string;
	caddyPort: number;
	cert: GatewayCert;
	lookup: (internalHost: string) => Promise<RouteRow | null>;
}

export interface GatewayHandle {
	port: number;
	close: () => Promise<void>;
}

const link = (sockets: Socket[], onKill?: () => void) => {
	const kill = () => {
		onKill?.();
		for (const socket of sockets) socket.destroy();
	};
	for (const socket of sockets) {
		socket.on("error", kill);
		socket.on("close", kill);
	}
};

const forwardToCaddy = (client: Socket, acc: Buffer, caddyHost: string, caddyPort: number) => {
	const upstream = connect(caddyPort, caddyHost);
	upstream.on("error", () => client.destroy());
	upstream.on("connect", () => {
		if (acc.length) upstream.write(acc);
		client.pipe(upstream).pipe(client);
		client.resume();
	});
	link([client, upstream]);
};

const terminateForEngine = (
	client: Socket,
	acc: Buffer,
	cert: GatewayCert,
	route: Extract<GatewayRoute, { kind: "engine" }>,
) => {
	const tlsOptions: ServerOptions = { key: cert.key, cert: cert.cert };
	const terminator = createTlsServer(tlsOptions, (plain) => {
		if (route.ssh) {
			forwardViaSsh(plain, route.ssh);
			return;
		}
		const engine = connect(route.port, route.host);
		plain.pipe(engine);
		engine.pipe(plain);
		engine.on("error", () => plain.destroy());
		link([plain, engine]);
	});
	terminator.on("error", () => client.destroy());
	terminator.listen(0, "127.0.0.1", () => {
		const localPort = (terminator.address() as AddressInfo).port;
		const toTerminator = connect(localPort, "127.0.0.1");
		toTerminator.on("error", () => client.destroy());
		toTerminator.on("connect", () => {
			if (acc.length) toTerminator.write(acc);
			client.pipe(toTerminator).pipe(client);
			client.resume();
		});
		link([client, toTerminator], () => terminator.close());
	});
};

export const startGateway = async (options: GatewayOptions): Promise<GatewayHandle> => {
	const active = new Set<Socket>();
	const server = createServer((client) => {
		active.add(client);
		client.on("close", () => active.delete(client));
		void (async () => {
			try {
				let buf = await readClientHello(client);
				for (let round = 0; round < 3 && buf; round += 1) {
					const preamble = parsePostgresPreamble(buf);
					if (!preamble) break;
					client.write(preamble === "ssl" ? "S" : "N");
					buf = await readClientHello(client);
				}
				if (!buf) {
					client.destroy();
					return;
				}
				const parse = parseClientHello(buf);
				const route = await resolveGatewayRoute(parse.kind === "tls" ? parse.sni : null, {
					baseDomain: options.baseDomain,
					remoteAddress: client.remoteAddress ?? "",
					lookup: options.lookup,
				});
				if (route.kind === "engine") {
					terminateForEngine(client, buf, options.cert, route);
				} else {
					forwardToCaddy(client, buf, options.caddyHost, options.caddyPort);
				}
			} catch {
				client.destroy();
			}
		})();
	});
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(options.port, () => {
			server.removeListener("error", reject);
			resolve();
		});
	});
	const address = server.address() as AddressInfo;
	return {
		port: address.port,
		close: () =>
			new Promise((resolve) => {
				for (const socket of active) socket.destroy();
				server.close(() => resolve());
			}),
	};
};

interface LookupRow {
	internal_host: string;
	internal_port: number;
	status: string;
	public_access: boolean;
	allow_public_access_from_anywhere: boolean;
	allowed_cidrs: unknown;
	external_port: number | null;
	server_id: string | null;
	server_host: string | null;
	server_port: number | null;
	server_mode: string | null;
	ssh_user: string | null;
	ssh_key: string | null;
	ssh_key_iv: string | null;
	ssh_key_tag: string | null;
	ssh_key_id: string | null;
}

const decryptServerKey = (encrypted: string, iv: string, tag: string): string | null => {
	try {
		return decryptValue(encrypted, iv, tag, config.envEncryptionKey);
	} catch {
		return null;
	}
};

const resolveSshKey = async (pool: Pool, row: LookupRow): Promise<string | null> => {
	if (row.ssh_key && row.ssh_key_iv && row.ssh_key_tag) {
		return decryptServerKey(row.ssh_key, row.ssh_key_iv, row.ssh_key_tag);
	}
	if (!row.ssh_key_id) return null;
	const pooled = await pool.query<{ private_key_encrypted: string; private_key_iv: string; private_key_tag: string }>(
		`SELECT private_key_encrypted, private_key_iv, private_key_tag FROM ssh_keys WHERE id = $1`,
		[row.ssh_key_id],
	);
	const key = pooled.rows[0];
	if (!key) return null;
	return decryptServerKey(key.private_key_encrypted, key.private_key_iv, key.private_key_tag);
};

const resolveSshTarget = async (pool: Pool, row: LookupRow): Promise<SshEngineTarget | null> => {
	if (!row.server_id || !row.server_host || row.server_id === "local" || row.server_mode === "local") return null;
	if (!row.external_port) return null;
	const key = await resolveSshKey(pool, row);
	if (!key) return null;
	return {
		host: row.server_host,
		port: row.server_port || 22,
		user: row.ssh_user || "root",
		key,
		serverId: row.server_id,
		targetPort: row.external_port,
	};
};

const createPoolLookup =
	(pool: Pool) =>
	async (internalHost: string): Promise<RouteRow | null> => {
		const result = await pool.query<LookupRow>(
			`SELECT d.internal_host, d.internal_port, d.status, d.public_access, d.allow_public_access_from_anywhere,
			d.allowed_cidrs, d.external_port, d.server_id, s.host AS server_host, s.port AS server_port,
			s.mode AS server_mode, s.ssh_user, s.ssh_key, s.ssh_key_iv, s.ssh_key_tag, s.ssh_key_id
		 FROM databases d LEFT JOIN servers s ON s.id = d.server_id
		 WHERE d.internal_host = $1`,
			[internalHost],
		);
		const row = result.rows[0];
		if (!row) return null;
		return {
			internalHost: row.internal_host,
			internalPort: row.internal_port,
			status: row.status,
			publicAccess: row.public_access,
			allowAnywhere: row.allow_public_access_from_anywhere,
			allowedCidrs: Array.isArray(row.allowed_cidrs)
				? row.allowed_cidrs.filter((value): value is string => typeof value === "string")
				: [],
			ssh: await resolveSshTarget(pool, row),
		};
	};

if (import.meta.main) {
	const cert = await loadOrCreateGatewayCert(config.gatewayCertDir);
	const pool = new Pool({ connectionString: config.databaseUrl, max: 4, connectionTimeoutMillis: 3000 });
	const handle = await startGateway({
		port: Number(process.env.GATEWAY_PORT ?? 443),
		baseDomain: config.caddyBaseDomain,
		caddyHost: process.env.CADDY_UPSTREAM_HOST ?? "caddy",
		caddyPort: 443,
		cert,
		lookup: createPoolLookup(pool),
	});
	console.log(`[Gateway] listening on :${handle.port} (base domain: ${config.caddyBaseDomain})`);
	const shutdown = () => {
		handle.close().then(() => process.exit(0));
	};
	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
}
