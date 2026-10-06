import { spawn } from "node:child_process";
import type { Readable } from "node:stream";
import type { Server } from "../types";
import { safeSpawn, terminateWithEscalation } from "./process-exec";
import { ensureSshKey, getDockerSshTarget } from "./ssh";

export interface ExecResult {
	code: number;
	stdout: string;
	stderr: string;
}

export function getDockerTargetArgs(server?: Server | null): string[] {
	if (server?.mode === "ssh") {
		return ["-H", getDockerSshTarget(server)];
	}
	if (server?.mode === "docker_tcp") {
		return ["-H", `tcp://${server.host}:${server.port || 2376}`];
	}
	return [];
}

export async function dockerRun(cmd: string, args: string[], server?: Server | null): Promise<string> {
	const targetArgs = getDockerTargetArgs(server);
	const fullArgs = targetArgs.length > 0 ? [...targetArgs, ...args] : args;
	const res = await safeSpawn(cmd, fullArgs, { timeoutMs: 120_000 });
	if (res.code === 0) {
		return `${res.stdout}\n${res.stderr}`.trim();
	}
	throw new Error(`${cmd} ${fullArgs.join(" ")} failed (${res.code}): ${res.stderr}`);
}

export async function dockerRunTry(cmd: string, args: string[], server?: Server | null): Promise<string | undefined> {
	try {
		return await dockerRun(cmd, args, server);
	} catch {
		return undefined;
	}
}

export function dockerExecStream(containerName: string, cmd: string[], server?: Server | null): Readable {
	const targetArgs = getDockerTargetArgs(server);
	const args = ["exec", containerName, ...cmd];
	const fullArgs = targetArgs.length > 0 ? [...targetArgs, ...args] : args;
	const isPosix = process.platform !== "win32";
	const child = spawn("docker", fullArgs, {
		detached: isPosix,
		stdio: ["ignore", "pipe", "pipe"],
	});

	let terminationHandle: { cancel: () => void } | null = null;
	const terminate = () => {
		if (terminationHandle) return;
		terminationHandle = terminateWithEscalation(child, 3000);
	};

	child.stderr?.on("data", () => {});
	child.on("error", () => terminate());

	child.stdout?.on("close", () => {
		if (!child.killed) terminate();
	});
	child.stdout?.on("error", () => {
		if (!child.killed) terminate();
	});

	return child.stdout!;
}

export async function dockerExec(containerName: string, cmd: string[], server?: Server | null): Promise<ExecResult> {
	const targetArgs = getDockerTargetArgs(server);
	const args = ["exec", containerName, ...cmd];
	const fullArgs = targetArgs.length > 0 ? [...targetArgs, ...args] : args;
	const res = await safeSpawn("docker", fullArgs, { timeoutMs: 60_000 });
	return {
		code: res.code,
		stdout: res.stdout,
		stderr: res.stderr,
	};
}

export async function dockerExecWithStdin(
	containerName: string,
	cmd: string[],
	input: Readable,
	server?: Server | null,
): Promise<ExecResult> {
	const targetArgs = getDockerTargetArgs(server);
	const args = ["exec", "-i", containerName, ...cmd];
	const fullArgs = targetArgs.length > 0 ? [...targetArgs, ...args] : args;
	const isPosix = process.platform !== "win32";

	return new Promise((resolve, reject) => {
		const child = spawn("docker", fullArgs, {
			detached: isPosix,
			stdio: ["pipe", "ignore", "pipe"],
		});
		let stderr = "";
		let terminationHandle: { cancel: () => void } | null = null;

		const terminate = () => {
			if (terminationHandle) return;
			terminationHandle = terminateWithEscalation(child, 3000);
		};

		child.stderr?.on("data", (chunk) => (stderr += String(chunk)));
		input.pipe(child.stdin!);

		input.on("error", (err) => {
			terminate();
			reject(err);
		});

		child.on("close", (code) => {
			if (terminationHandle) terminationHandle.cancel();
			resolve({ code: code ?? 1, stdout: "", stderr: stderr.trim() });
		});

		child.on("error", (err) => {
			terminate();
			reject(err);
		});
	});
}

export async function ensureContainerRemoved(name: string, server?: Server | null): Promise<void> {
	try {
		await dockerRun("docker", ["rm", "-f", name], server);
	} catch (error) {
		if (!/No such (?:container|volume)|No such object/.test(error instanceof Error ? error.message : String(error)))
			throw error;
	}
}

export async function ensureVolumeRemoved(name: string, server?: Server | null): Promise<void> {
	try {
		await dockerRun("docker", ["volume", "rm", "-f", name], server);
	} catch (error) {
		if (!/No such (?:container|volume)|No such object/.test(error instanceof Error ? error.message : String(error)))
			throw error;
	}
}
