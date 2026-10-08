import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Duplex } from "node:stream";

export interface SshEngineTarget {
	host: string;
	port: number;
	user: string;
	key: string;
	serverId: string;
	targetPort: number;
}

const KEYS_DIR = join(tmpdir(), "dequel_gateway_keys");

const safeName = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");

export const writeIdentityFile = (target: SshEngineTarget): string => {
	if (!existsSync(KEYS_DIR)) {
		mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
	}
	try {
		chmodSync(KEYS_DIR, 0o700);
	} catch {}

	const path = join(KEYS_DIR, `id_${safeName(target.serverId)}`);
	try {
		if (existsSync(path)) unlinkSync(path);
	} catch {}
	writeFileSync(path, `${target.key.trim()}\n`, { mode: 0o600 });
	try {
		chmodSync(path, 0o600);
	} catch {}
	return path;
};

export const buildSshArgs = (target: SshEngineTarget, keyPath: string): string[] => [
	"-i",
	keyPath,
	"-p",
	String(target.port),
	"-o",
	"IdentitiesOnly=yes",
	"-o",
	"BatchMode=yes",
	"-o",
	"StrictHostKeyChecking=no",
	"-o",
	`UserKnownHostsFile=${join(KEYS_DIR, "known_hosts")}`,
	"-o",
	"ConnectTimeout=10",
	"-W",
	`127.0.0.1:${target.targetPort}`,
	`${target.user}@${target.host}`,
];

export const forwardViaSsh = (stream: Duplex, target: SshEngineTarget) => {
	let keyPath: string;
	try {
		keyPath = writeIdentityFile(target);
	} catch (err) {
		console.error("[Gateway SSH] Failed to write identity file:", err);
		stream.destroy(err as Error);
		return null;
	}

	const child = spawn("ssh", buildSshArgs(target, keyPath), {
		stdio: ["pipe", "pipe", "ignore"],
	});
	const kill = () => {
		if (child.exitCode === null && !child.killed) child.kill();
	};
	stream.on("error", kill);
	stream.on("close", kill);
	child.on("error", () => stream.destroy());
	child.on("exit", () => stream.destroy());
	if (!child.stdin || !child.stdout) {
		kill();
		stream.destroy();
		return child;
	}
	child.stdin.on("error", () => {
		kill();
		stream.destroy();
	});
	stream.pipe(child.stdin);
	child.stdout.pipe(stream);
	return child;
};
