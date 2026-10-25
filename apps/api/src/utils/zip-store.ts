const crcTable = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

const crc32 = (data: Uint8Array): number => {
	let c = 0xffffffff;
	for (let i = 0; i < data.length; i++) {
		c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
};

export interface ZipEntry {
	name: string;
	content: string;
}

export const createZipStore = (entries: ZipEntry[]): Uint8Array => {
	const encoder = new TextEncoder();
	const chunks: Uint8Array[] = [];
	const central: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];
	let offset = 0;

	for (const entry of entries) {
		const name = encoder.encode(entry.name);
		const data = encoder.encode(entry.content);
		const crc = crc32(data);
		const header = new Uint8Array(30 + name.length);
		const view = new DataView(header.buffer);
		view.setUint32(0, 0x04034b50, true);
		view.setUint16(4, 20, true);
		view.setUint16(6, 0, true);
		view.setUint16(8, 0, true);
		view.setUint16(10, 0, true);
		view.setUint16(12, 0x21, true);
		view.setUint32(14, crc, true);
		view.setUint32(18, data.length, true);
		view.setUint32(22, data.length, true);
		view.setUint16(26, name.length, true);
		view.setUint16(28, 0, true);
		header.set(name, 30);
		chunks.push(header, data);
		central.push({ name, crc, size: data.length, offset });
		offset += header.length + data.length;
	}

	const centralStart = offset;
	for (const entry of central) {
		const dir = new Uint8Array(46 + entry.name.length);
		const view = new DataView(dir.buffer);
		view.setUint32(0, 0x02014b50, true);
		view.setUint16(4, 20, true);
		view.setUint16(6, 20, true);
		view.setUint16(8, 0, true);
		view.setUint16(10, 0, true);
		view.setUint16(12, 0, true);
		view.setUint16(14, 0x21, true);
		view.setUint32(16, entry.crc, true);
		view.setUint32(20, entry.size, true);
		view.setUint32(24, entry.size, true);
		view.setUint16(28, entry.name.length, true);
		view.setUint32(42, entry.offset, true);
		dir.set(entry.name, 46);
		chunks.push(dir);
		offset += dir.length;
	}

	const eocd = new Uint8Array(22);
	const view = new DataView(eocd.buffer);
	view.setUint32(0, 0x06054b50, true);
	view.setUint16(8, central.length, true);
	view.setUint16(10, central.length, true);
	view.setUint32(12, offset - centralStart, true);
	view.setUint32(16, centralStart, true);
	chunks.push(eocd);

	const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const output = new Uint8Array(total);
	let cursor = 0;
	for (const chunk of chunks) {
		output.set(chunk, cursor);
		cursor += chunk.length;
	}
	return output;
};
