import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, connect as netConnect, type Server } from "node:net";
import { connect as tlsConnect, createServer as createTlsServer } from "node:tls";
import { loadOrCreateGatewayCert, persistGatewayCert, type GatewayCert } from "../cert";
import { startGateway, type GatewayHandle } from "../gateway";
import type { RouteRow } from "../routes";

const BASE_DOMAIN = "test.local";

const echoData =
	(write: (sock: { write: (d: Buffer) => void }, payload: Buffer) => void) => (sock: { write: (d: Buffer) => void }) =>
		sock.on("data", (d) => write(sock, d));

const startEcho = (
	options: { key?: string; cert?: string } | undefined,
	prefix: (payload: Buffer) => Buffer,
): Promise<{ server: Server; port: number }> =>
	new Promise((resolve) => {
		const handler = echoData((sock, payload) => sock.write(prefix(payload)));
		const server = options ? createTlsServer(options, handler) : createServer(handler);
		server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.address() as { port: number }).port }));
	});

const roundTrip = (port: number, servername: string | undefined, payload: string): Promise<string> =>
	new Promise((resolve, reject) => {
		const socket = servername
			? tlsConnect({ host: "127.0.0.1", port, servername, rejectUnauthorized: false })
			: netConnect({ host: "127.0.0.1", port });
		let buf = "";
		let sent = false;
		const send = () => {
			if (sent) return;
			sent = true;
			socket.write(payload);
		};
		socket.on("data", (d) => {
			buf += d.toString();
			if (buf.includes(payload)) {
				socket.destroy();
				resolve(buf);
			}
		});
		socket.on("connect", send);
		socket.on("secureConnect", send);
		socket.on("error", reject);
		setTimeout(() => reject(new Error(`timeout, got: "${buf}"`)), 5000);
	});

let certDir: string;
let cert: GatewayCert;
let engine: { server: Server; port: number };
let tlsCaddy: { server: Server; port: number };
let plainCaddy: { server: Server; port: number };
let gateway: GatewayHandle;
let plainGateway: GatewayHandle;

const lookup = async (host: string): Promise<RouteRow | null> =>
	host === "db-abc123"
		? {
				internalHost: "127.0.0.1",
				internalPort: engine.port,
				status: "running",
				publicAccess: true,
				allowAnywhere: true,
				allowedCidrs: [],
			}
		: null;

beforeAll(async () => {
	certDir = await mkdtemp(join(tmpdir(), "gw-cert-"));
	cert = await loadOrCreateGatewayCert(certDir);
	engine = await startEcho(undefined, (payload) => Buffer.from(`ENG:${payload}`));
	tlsCaddy = await startEcho({ key: cert.key, cert: cert.cert }, (payload) => Buffer.from(`CADDY:${payload}`));
	plainCaddy = await startEcho(undefined, (payload) => Buffer.from(`CADDY:${payload}`));
	gateway = await startGateway({
		port: 0,
		baseDomain: BASE_DOMAIN,
		caddyHost: "127.0.0.1",
		caddyPort: tlsCaddy.port,
		cert,
		lookup,
	});
	plainGateway = await startGateway({
		port: 0,
		baseDomain: BASE_DOMAIN,
		caddyHost: "127.0.0.1",
		caddyPort: plainCaddy.port,
		cert,
		lookup,
	});
});

afterAll(async () => {
	await gateway.close();
	await plainGateway.close();
	engine.server.close();
	tlsCaddy.server.close();
	plainCaddy.server.close();
	await rm(certDir, { recursive: true, force: true });
});

describe("gateway", () => {
	it("terminates TLS for a known database SNI and pipes to its engine", async () => {
		expect(await roundTrip(gateway.port, `db-abc123.${BASE_DOMAIN}`, "PING")).toBe("ENG:PING");
	});

	it("forwards unknown database hostnames to caddy", async () => {
		expect(await roundTrip(gateway.port, `db-unknown.${BASE_DOMAIN}`, "PING")).toBe("CADDY:PING");
	});

	it("forwards application hostnames to caddy", async () => {
		expect(await roundTrip(gateway.port, "app.example.com", "PING")).toBe("CADDY:PING");
	});

	it("forwards non-TLS traffic to caddy untouched", async () => {
		expect(await roundTrip(plainGateway.port, undefined, "hello")).toBe("CADDY:hello");
	});

	it("forwards raw TLS bytes to caddy when the upstream speaks plain TCP", async () => {
		const captured = new Promise<Buffer>((resolve) => {
			const server = createServer((sock) => {
				sock.once("data", (d) => {
					resolve(d);
					server.close();
				});
			});
			server.listen(0, "127.0.0.1", async () => {
				const plainServer = await startGateway({
					port: 0,
					baseDomain: BASE_DOMAIN,
					caddyHost: "127.0.0.1",
					caddyPort: (server.address() as { port: number }).port,
					cert,
					lookup,
				});
				const socket = tlsConnect({
					host: "127.0.0.1",
					port: plainServer.port,
					servername: "app.example.com",
					rejectUnauthorized: false,
				});
				socket.on("error", () => {});
				setTimeout(() => plainServer.close(), 2000);
			});
		});
		const bytes = await captured;
		expect(bytes[0]).toBe(0x16);
		expect(bytes.length).toBeGreaterThan(5);
	});

	it("answers the postgres SSLRequest preamble, then routes the TLS handshake", async () => {
		const hello = await new Promise<Buffer>((resolve) => {
			const server = createServer((sock) => {
				let acc = Buffer.alloc(0);
				sock.on("data", (d) => {
					acc = Buffer.concat([acc, d]);
					if (acc.length >= 5 && acc.length >= 5 + acc.readUInt16BE(3)) {
						sock.destroy();
						server.close();
						resolve(acc);
					}
				});
			});
			server.listen(0, "127.0.0.1", () => {
				const client = tlsConnect({
					host: "127.0.0.1",
					port: (server.address() as { port: number }).port,
					servername: `db-abc123.${BASE_DOMAIN}`,
					rejectUnauthorized: false,
				});
				client.on("error", () => {});
				client.on("secureConnect", () => client.end());
			});
		});
		const response = await new Promise<Buffer>((resolve, reject) => {
			const socket = netConnect({ host: "127.0.0.1", port: gateway.port });
			let buf = Buffer.alloc(0);
			let stage: "preamble" | "hello" = "preamble";
			socket.on("connect", () => {
				const sslRequest = Buffer.alloc(8);
				sslRequest.writeUInt32BE(8, 0);
				sslRequest.writeUInt32BE(80877103, 4);
				socket.write(sslRequest);
			});
			socket.on("data", (d) => {
				buf = Buffer.concat([buf, d]);
				if (stage === "preamble" && buf.length >= 1) {
					if (buf.toString()[0] !== "S") return reject(new Error(`expected S, got ${JSON.stringify(buf)}`));
					stage = "hello";
					buf = Buffer.alloc(0);
					socket.write(hello);
				} else if (stage === "hello" && buf.length >= 1) {
					socket.destroy();
					resolve(buf);
				}
			});
			socket.on("error", reject);
			setTimeout(() => reject(new Error(`timeout at ${stage}`)), 5000);
		});
		expect(response[0]).toBe(0x16);
	});

	it("generates a cert once and reuses it on disk", async () => {
		const again = await loadOrCreateGatewayCert(certDir);
		expect(again.cert).toBe(cert.cert);
		const otherDir = await mkdtemp(join(tmpdir(), "gw-cert2-"));
		const fresh = await loadOrCreateGatewayCert(otherDir);
		await persistGatewayCert(otherDir, fresh);
		const reloaded = await loadOrCreateGatewayCert(otherDir);
		expect(reloaded.key).toBe(fresh.key);
		expect(reloaded.cert).toBe(fresh.cert);
		await rm(otherDir, { recursive: true, force: true });
	});
});
