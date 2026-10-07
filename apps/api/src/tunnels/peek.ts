export type ClientHelloParse = { kind: "need-more" } | { kind: "not-tls" } | { kind: "tls"; sni: string | null };

const collectHandshake = (buf: Buffer): { needMore: boolean } | { invalid: true } | { body: Buffer } => {
	let offset = 0;
	const chunks: Buffer[] = [];
	while (offset + 5 <= buf.length) {
		if (buf[offset] !== 0x16) return { invalid: true };
		const recordLen = buf.readUInt16BE(offset + 3);
		const end = offset + 5 + recordLen;
		if (end > buf.length) return { needMore: true };
		chunks.push(buf.subarray(offset + 5, end));
		offset = end;
		const body = chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks);
		if (body.length >= 4) {
			const hsLen = body.readUIntBE(1, 3);
			if (body.length >= 4 + hsLen) return { body: body.subarray(0, 4 + hsLen) };
		}
	}
	return { needMore: true };
};

const extractSni = (hello: Buffer): string | null => {
	let offset = 4 + 2 + 32;
	if (offset > hello.length) return null;
	const sessionIdLen = hello[offset];
	offset += 1 + sessionIdLen;
	if (offset + 2 > hello.length) return null;
	const cipherLen = hello.readUInt16BE(offset);
	offset += 2 + cipherLen;
	if (offset + 1 > hello.length) return null;
	const compLen = hello[offset];
	offset += 1 + compLen;
	if (offset + 2 > hello.length) return null;
	const extLen = hello.readUInt16BE(offset);
	offset += 2;
	const extEnd = Math.min(offset + extLen, hello.length);
	while (offset + 4 <= extEnd) {
		const type = hello.readUInt16BE(offset);
		const len = hello.readUInt16BE(offset + 2);
		offset += 4;
		if (offset + len > extEnd) return null;
		if (type === 0x0000 && len >= 5) {
			const listLen = hello.readUInt16BE(offset);
			let inner = offset + 2;
			const listEnd = offset + 2 + listLen;
			while (inner + 3 <= listEnd) {
				const nameType = hello[inner];
				const nameLen = hello.readUInt16BE(inner + 1);
				inner += 3;
				if (inner + nameLen > listEnd) return null;
				if (nameType === 0) return hello.subarray(inner, inner + nameLen).toString("utf8");
				inner += nameLen;
			}
			return null;
		}
		offset += len;
	}
	return null;
};

export const parseClientHello = (buf: Buffer): ClientHelloParse => {
	if (buf.length === 0) return { kind: "need-more" };
	if (buf[0] !== 0x16) return { kind: "not-tls" };
	if (buf.length < 5) return { kind: "need-more" };
	if (buf[1] < 0x03 || buf[1] > 0x04) return { kind: "not-tls" };
	const collected = collectHandshake(buf);
	if ("invalid" in collected) return { kind: "not-tls" };
	if ("needMore" in collected) {
		return buf.length >= 65_536 ? { kind: "not-tls" } : { kind: "need-more" };
	}
	const body = collected.body;
	if (body[0] !== 0x01) return { kind: "not-tls" };
	return { kind: "tls", sni: extractSni(body) };
};

export type PostgresPreamble = "ssl" | "gss";

export const parsePostgresPreamble = (buf: Buffer): PostgresPreamble | null => {
	if (buf.length < 8) return null;
	if (buf.readUInt32BE(0) !== 8) return null;
	const code = buf.readUInt32BE(4);
	if (code === 80877103) return "ssl";
	if (code === 80877104) return "gss";
	return null;
};

export const readClientHello = (
	socket: NodeJS.ReadableStream & { destroy: () => void },
	maxBytes = 65_536,
	timeoutMs = 5_000,
): Promise<Buffer | null> =>
	new Promise((resolve) => {
		let acc = Buffer.alloc(0);
		let settled = false;
		const finish = (value: Buffer | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			socket.removeListener("readable", onReadable);
			socket.removeListener("end", onEnd);
			socket.removeListener("error", onEnd);
			resolve(value);
		};
		const check = () => {
			const parse = parseClientHello(acc);
			if (parse.kind !== "need-more") finish(acc);
			else if (acc.length >= maxBytes) finish(null);
		};
		const onReadable = () => {
			const chunk = (socket as { read: () => Buffer | null }).read();
			if (chunk && chunk.length) acc = Buffer.concat([acc, chunk]);
			check();
		};
		const onEnd = () => finish(null);
		const timer = setTimeout(() => finish(acc.length ? acc : null), timeoutMs);
		socket.on("readable", onReadable);
		socket.on("end", onEnd);
		socket.on("error", onEnd);
		check();
	});
