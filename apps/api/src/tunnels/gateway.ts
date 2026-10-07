import { connect, createServer, type Socket } from "node:net";
import { createServer as createTlsServer, type ServerOptions } from "node:tls";
import type { AddressInfo } from "node:net";
import { Pool } from "pg";
import { config } from "../utils/config";
import { loadOrCreateGatewayCert, type GatewayCert } from "./cert";
import { parseClientHello, parsePostgresPreamble, readClientHello } from "./peek";
import { resolveGatewayRoute, type RouteRow } from "./routes";

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

const terminateForEngine = (client: Socket, acc: Buffer, cert: GatewayCert, host: string, port: number) => {
	const tlsOptions: ServerOptions = { key: cert.key, cert: cert.cert };
	const terminator = createTlsServer(tlsOptions, (plain) => {
		const engine = connect(port, host);
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
					terminateForEngine(client, buf, options.cert, route.host, route.port);
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

const createPoolLookup =
	(pool: Pool) =>
	async (internalHost: string): Promise<RouteRow | null> => {
		const result = await pool.query<{
			internal_host: string;
			internal_port: number;
			status: string;
			public_access: boolean;
			allow_public_access_from_anywhere: boolean;
			allowed_cidrs: unknown;
		}>(
			`SELECT internal_host, internal_port, status, public_access, allow_public_access_from_anywhere, allowed_cidrs
		 FROM databases WHERE internal_host = $1`,
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
		process.exit(0);
	};
	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
}
