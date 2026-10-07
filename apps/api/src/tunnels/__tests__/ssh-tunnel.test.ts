import { afterAll, describe, expect, it } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { buildSshArgs, type SshEngineTarget, writeIdentityFile } from "../ssh-tunnel";

const TARGET: SshEngineTarget = {
	host: "13.49.231.115",
	port: 22,
	user: "admin",
	key: "  -----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----  ",
	serverId: "725e3b8c-4a61-4e01-86e7-18ed9b6c4c38",
	targetPort: 21628,
};

const keyPath = writeIdentityFile(TARGET);

afterAll(() => {
	rmSync(join(tmpdir(), "dequel_gateway_keys"), { recursive: true, force: true });
});

describe("writeIdentityFile", () => {
	it("writes a trimmed key with a trailing newline", () => {
		const content = readFileSync(keyPath, "utf-8");
		expect(content.startsWith("-----BEGIN OPENSSH PRIVATE KEY-----")).toBe(true);
		expect(content.endsWith("-----END OPENSSH PRIVATE KEY-----\n")).toBe(true);
	});
});

describe("buildSshArgs", () => {
	it("forwards stdio to the published port on the remote host", () => {
		const args = buildSshArgs(TARGET, keyPath);
		expect(args).toContain("-W");
		expect(args).toContain("127.0.0.1:21628");
		expect(args).toContain("-i");
		expect(args[args.length - 1]).toBe("admin@13.49.231.115");
		expect(args[args.indexOf("-p") + 1]).toBe("22");
		expect(args).toContain("IdentitiesOnly=yes");
		expect(args).toContain("BatchMode=yes");
	});

	it("sanitizes the server id used for the identity file name", () => {
		const path = writeIdentityFile({ ...TARGET, serverId: "../weird/id" });
		const name = basename(path);
		expect(name.startsWith("id_")).toBe(true);
		expect(name.includes("..")).toBe(false);
		expect(name.includes("/")).toBe(false);
	});
});
