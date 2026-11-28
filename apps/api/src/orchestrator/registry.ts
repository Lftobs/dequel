import { spawn } from "node:child_process";
import { getRegistryCredentials } from "../db/repo/registries";
import type { Server } from "../types";
import { dockerBin } from "../utils/docker-bin";
import { getDockerTargetArgs } from "../utils/docker-run";

const loginWithStdin = (args: string[], password: string): Promise<void> =>
	new Promise((resolve, reject) => {
		const child = spawn(dockerBin, args, { stdio: ["pipe", "ignore", "pipe"] });
		let stderr = "";
		child.stderr.on("data", (chunk) => {
			stderr += String(chunk);
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(stderr.trim() || `docker login exited with code ${code}`));
		});
		child.stdin.write(password);
		child.stdin.end();
	});

export const ensureRegistryLogin = async (
	registryId: string | null | undefined,
	server: Server | null | undefined,
	onLog: (line: string) => Promise<void>,
): Promise<void> => {
	if (!registryId) return;
	const credentials = await getRegistryCredentials(registryId);
	if (!credentials) return;
	const targetArgs = getDockerTargetArgs(server);
	await onLog(`Authenticating to registry ${credentials.url} on ${server?.name ?? "local"} node`);
	await loginWithStdin(
		[...targetArgs, "login", credentials.url, "-u", credentials.username, "--password-stdin"],
		credentials.password,
	);
};

export const pullImage = async (
	imageRef: string,
	policy: string,
	server: Server | null | undefined,
	onLog: (line: string) => Promise<void>,
): Promise<void> => {
	const targetArgs = getDockerTargetArgs(server);
	if (policy === "never") {
		const exists = await new Promise<boolean>((resolve) => {
			const child = spawn(dockerBin, [...targetArgs, "image", "inspect", imageRef], { stdio: "ignore" });
			child.on("error", () => resolve(false));
			child.on("close", (code) => resolve(code === 0));
		});
		if (!exists)
			throw new Error(`Image ${imageRef} is not present on ${server?.name ?? "local"} and pull policy is never`);
		return;
	}
	if (policy === "if-not-present") {
		const exists = await new Promise<boolean>((resolve) => {
			const child = spawn(dockerBin, [...targetArgs, "image", "inspect", imageRef], { stdio: "ignore" });
			child.on("error", () => resolve(false));
			child.on("close", (code) => resolve(code === 0));
		});
		if (exists) {
			await onLog(`Image ${imageRef} already present on node`);
			return;
		}
	}
	await onLog(`Pulling image ${imageRef} on ${server?.name ?? "local"} node`);
	await new Promise<void>((resolve, reject) => {
		const child = spawn(dockerBin, [...targetArgs, "pull", imageRef], { stdio: ["ignore", "pipe", "pipe"] });
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			for (const line of String(chunk)
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)) {
				void onLog(line);
			}
		});
		child.stderr.on("data", (chunk) => {
			stderr += String(chunk);
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`docker pull failed (${code}): ${stderr.trim()}`));
		});
	});
	await onLog(`Image ${imageRef} pulled`);
};
