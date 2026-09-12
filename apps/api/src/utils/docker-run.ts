import { spawn } from "node:child_process";
import type { Readable } from "node:stream";
import type { Server } from "../types";
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

export function dockerRun(cmd: string, args: string[], server?: Server | null): Promise<string> {
	return new Promise((resolve, reject) => {
		const targetArgs = getDockerTargetArgs(server);
		const fullArgs = targetArgs.length > 0 ? [...targetArgs, ...args] : args;
		const child = spawn(cmd, fullArgs, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => (stdout += String(chunk)));
		child.stderr.on("data", (chunk) => (stderr += String(chunk)));
		child.on("close", (code) => {
			if (code === 0) resolve(`${stdout}\n${stderr}`.trim());
			else reject(new Error(`${cmd} ${fullArgs.join(" ")} failed (${code}): ${stderr}`));
		});
	});
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
	const child = spawn("docker", fullArgs, { stdio: ["ignore", "pipe", "pipe"] });
	return child.stdout!;
}

export async function dockerExec(containerName: string, cmd: string[], server?: Server | null): Promise<ExecResult> {
	const targetArgs = getDockerTargetArgs(server);
	const args = ["exec", containerName, ...cmd];
	const fullArgs = targetArgs.length > 0 ? [...targetArgs, ...args] : args;
	return new Promise((resolve, reject) => {
		const child = spawn("docker", fullArgs, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (chunk) => (stdout += String(chunk)));
		child.stderr?.on("data", (chunk) => (stderr += String(chunk)));
		child.on("close", (code) => resolve({ code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() }));
		child.on("error", reject);
	});
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
	return new Promise((resolve, reject) => {
		const child = spawn("docker", fullArgs, { stdio: ["pipe", "ignore", "pipe"] });
		let stderr = "";
		child.stderr?.on("data", (chunk) => (stderr += String(chunk)));
		input.pipe(child.stdin!);
		child.on("close", (code) => resolve({ code: code ?? 1, stdout: "", stderr: stderr.trim() }));
		child.on("error", reject);
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
