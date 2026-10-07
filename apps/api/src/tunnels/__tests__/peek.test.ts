import { describe, expect, it } from "bun:test";
import { createServer, connect as netConnect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { parseClientHello, parsePostgresPreamble, readClientHello } from "../peek";

const captureClientHello = (servername: string): Promise<Buffer> =>
	new Promise((resolve, reject) => {
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
			const port = (server.address() as { port: number }).port;
			const c = tlsConnect({ host: "127.0.0.1", port, servername, rejectUnauthorized: false });
			c.on("error", reject);
			c.on("secureConnect", () => c.end());
		});
	});

describe("parseClientHello", () => {
	it("extracts SNI from a real ClientHello", async () => {
		const hello = await captureClientHello("db-abc123.test.local");
		const parse = parseClientHello(hello);
		expect(parse).toEqual({ kind: "tls", sni: "db-abc123.test.local" });
	});

	it("parses when the hello arrives fragmented", async () => {
		const hello = await captureClientHello("db-abc123.test.local");
		let acc = Buffer.alloc(0);
		let parse = parseClientHello(acc);
		for (const byte of hello) {
			acc = Buffer.concat([acc, Buffer.from([byte])]);
			parse = parseClientHello(acc);
			if (parse.kind !== "need-more") break;
		}
		expect(parse).toEqual({ kind: "tls", sni: "db-abc123.test.local" });
	});

	it("reports need-more for partial records and not-tls for other protocols", () => {
		expect(parseClientHello(Buffer.alloc(0))).toEqual({ kind: "need-more" });
		expect(parseClientHello(Buffer.from([0x16]))).toEqual({ kind: "need-more" });
		expect(parseClientHello(Buffer.from("GET / HTTP/1.1\r\n"))).toEqual({ kind: "not-tls" });
		expect(parseClientHello(Buffer.concat([Buffer.from([0x16, 0x03, 0x01, 0x00, 0x20]), Buffer.alloc(5)]))).toEqual({
			kind: "need-more",
		});
	});
});

describe("parsePostgresPreamble", () => {
	const preamble = (code: number): Buffer => {
		const buf = Buffer.alloc(8);
		buf.writeUInt32BE(8, 0);
		buf.writeUInt32BE(code, 4);
		return buf;
	};

	it("recognizes SSLRequest and GSSENCRequest", () => {
		expect(parsePostgresPreamble(preamble(80877103))).toBe("ssl");
		expect(parsePostgresPreamble(preamble(80877104))).toBe("gss");
	});

	it("rejects other shapes", () => {
		expect(parsePostgresPreamble(Buffer.alloc(0))).toBeNull();
		expect(parsePostgresPreamble(Buffer.from([0, 0, 0, 7, 4, 210, 22, 47]))).toBeNull();
		expect(parsePostgresPreamble(Buffer.from([0x16, 0x03, 0x01, 0x00, 0x05, 1, 2, 3]))).toBeNull();
	});
});

describe("readClientHello", () => {
	it("accumulates until a full hello is available", async () => {
		const hello = await captureClientHello("db-abc123.test.local");
		const server = createServer((sock) => {
			readClientHello(sock).then((buf) => {
				expect(buf).not.toBeNull();
				expect(parseClientHello(buf!)).toEqual({ kind: "tls", sni: "db-abc123.test.local" });
				sock.destroy();
				server.close();
			});
		});
		await new Promise<void>((resolve) => {
			server.listen(0, "127.0.0.1", () => {
				const port = (server.address() as { port: number }).port;
				const c = netConnect(port, "127.0.0.1", () => c.write(hello));
				c.on("close", () => resolve());
			});
		});
	});

	it("drains a hello delivered as several chunks in one readable event", async () => {
		const hello = await captureClientHello("db-abc123.test.local");
		const server = createServer((sock) => {
			readClientHello(sock).then((buf) => {
				expect(buf).not.toBeNull();
				expect(parseClientHello(buf!)).toEqual({ kind: "tls", sni: "db-abc123.test.local" });
				sock.destroy();
				server.close();
			});
		});
		await new Promise<void>((resolve, reject) => {
			server.listen(0, "127.0.0.1", () => {
				const port = (server.address() as { port: number }).port;
				const c = netConnect(port, "127.0.0.1", () => {
					const step = Math.ceil(hello.length / 3);
					c.write(hello.subarray(0, step));
					c.write(hello.subarray(step, step * 2));
					c.write(hello.subarray(step * 2));
				});
				c.on("error", reject);
				c.on("close", () => resolve());
			});
		});
	});

	it("returns quickly for non-TLS bytes", async () => {
		const server = createServer((sock) => {
			readClientHello(sock).then((buf) => {
				expect(parseClientHello(buf!)).toEqual({ kind: "not-tls" });
				sock.destroy();
				server.close();
			});
		});
		await new Promise<void>((resolve) => {
			server.listen(0, "127.0.0.1", () => {
				const port = (server.address() as { port: number }).port;
				const c = netConnect(port, "127.0.0.1", () => c.write("garbage not tls"));
				c.on("close", () => resolve());
			});
		});
	});
});
