import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config";
import type { AgentJobEnvelope } from "./protocol";
import type {
	RemoteDeployResult,
	RemoteDestroyPayload,
	RemoteGitDeployPayload,
	RemoteRollbackPayload,
	RemoteRoutePayload,
	RemoteRouteResult,
	RemoteScalePayload,
	RemoteScaleResult,
} from "./types";

export type {
	RemoteDeployResult,
	RemoteDestroyPayload,
	RemoteGitDeployPayload,
	RemoteRollbackPayload,
	RemoteRoutePayload,
	RemoteRouteResult,
	RemoteScalePayload,
	RemoteScaleResult,
};

type Progress = (stage: string, message: string) => void;
type ContainerSpec = {
	deploymentId: string;
	projectId?: string | null;
	appPort: number;
	cpuLimit?: number | null;
	memoryLimitMb?: number | null;
	environmentVariables: { key: string; value: string }[];
	volumes?: { volumeName: string; mountPath: string }[];
};

import {
	ID_RE,
	IMAGE_TAG_RE,
	MOUNT_PATH_RE,
	SHA_RE,
	VOLUME_NAME_RE,
	validateDeploymentPayload,
	validateDestroyPayload,
	validateRollbackPayload,
	validateRoutePayload,
	validateScalePayload,
} from "./validation";

export {
	validateDeploymentPayload,
	validateDestroyPayload,
	validateRollbackPayload,
	validateRoutePayload,
	validateScalePayload,
};

const run = (
	command: string,
	args: string[],
	options: { cwd?: string; signal?: AbortSignal; onLine?: (line: string) => void; timeoutMs?: number } = {},
) =>
	new Promise<string>((resolve, reject) => {
		const isPosix = process.platform !== "win32";
		const child = spawn(command, args, {
			cwd: options.cwd,
			detached: isPosix,
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				GIT_TERMINAL_PROMPT: "0",
				GIT_ASKPASS: "",
				SSH_ASKPASS: "",
			},
		});
		let stdout = "";
		let stderr = "";
		let buffer = "";
		let settled = false;
		let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
		let escalationTimer: ReturnType<typeof setTimeout> | null = null;

		const terminate = () => {
			if (settled || escalationTimer) return;
			if (isPosix && child.pid) {
				try {
					process.kill(-child.pid, "SIGTERM");
				} catch {}
			} else {
				try {
					child.kill("SIGTERM");
				} catch {}
			}
			escalationTimer = setTimeout(() => {
				if (isPosix && child.pid) {
					try {
						process.kill(-child.pid, "SIGKILL");
					} catch {}
				} else {
					try {
						child.kill("SIGKILL");
					} catch {}
				}
			}, 4000);
			if (typeof escalationTimer.unref === "function") escalationTimer.unref();
		};

		const cleanup = () => {
			settled = true;
			if (timeoutTimer) clearTimeout(timeoutTimer);
			if (escalationTimer) clearTimeout(escalationTimer);
			if (options.signal) options.signal.removeEventListener("abort", onAbort);
		};

		const onAbort = () => {
			terminate();
		};

		if (options.signal) {
			if (options.signal.aborted) onAbort();
			else options.signal.addEventListener("abort", onAbort, { once: true });
		}

		if (options.timeoutMs) {
			timeoutTimer = setTimeout(() => terminate(), options.timeoutMs);
			if (typeof timeoutTimer.unref === "function") timeoutTimer.unref();
		}

		const emit = (chunk: unknown) => {
			const text = String(chunk);
			buffer += text;
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";
			for (const line of lines) if (line.trim()) options.onLine?.(line.trim());
		};
		child.stdout?.on("data", (chunk) => {
			stdout += String(chunk);
			emit(chunk);
		});
		child.stderr?.on("data", (chunk) => {
			stderr += String(chunk);
			emit(chunk);
		});
		child.on("error", (error) => {
			cleanup();
			reject(error);
		});
		child.on("close", (code) => {
			cleanup();
			if (buffer.trim()) options.onLine?.(buffer.trim());
			if (code === 0) resolve(stdout.trim());
			else reject(new Error(`${command} failed (${code}): ${(stderr || stdout).trim()}`));
		});
	});

const slugify = (value: string) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40) || "app";

const ensureNetwork = async () => {
	await run("docker", ["network", "inspect", config.dockerNetwork]).catch(() =>
		run("docker", ["network", "create", config.dockerNetwork]),
	);
};

const prepareSource = async (
	payload: RemoteGitDeployPayload,
	workspace: string,
	signal: AbortSignal,
	progress: Progress,
) => {
	await rm(workspace, { recursive: true, force: true });
	await mkdir(workspace, { recursive: true });
	progress("source", `Cloning ${payload.gitUrl}`);
	if (payload.commitSha) {
		await run("git", ["init"], { cwd: workspace, signal });
		await run("git", ["remote", "add", "origin", payload.gitUrl], { cwd: workspace, signal });
		await run("git", ["fetch", "--depth", "1", "origin", payload.commitSha], { cwd: workspace, signal });
		await run("git", ["checkout", "--detach", "FETCH_HEAD"], { cwd: workspace, signal });
	} else {
		const args = ["clone", "--depth", "1"];
		if (payload.branch) args.push("--branch", payload.branch);
		args.push("--", payload.gitUrl, workspace);
		await run("git", args, { signal });
	}
	return run("git", ["rev-parse", "HEAD"], { cwd: workspace, signal });
};

const buildImage = async (
	payload: RemoteGitDeployPayload,
	workspace: string,
	imageTag: string,
	signal: AbortSignal,
	progress: Progress,
) => {
	progress("build", `Building image ${imageTag}`);
	const args = ["build", "--name", imageTag, "--progress", "plain", "--cache-key", `project-${payload.projectId}`];
	for (const env of payload.environmentVariables) args.push("--env", `${env.key}=${env.value}`);
	args.push(workspace);
	await run("railpack", args, {
		signal,
		timeoutMs: 20 * 60_000,
		onLine: (line) => progress("build", line),
	});
};

const startContainer = async (
	spec: ContainerSpec,
	imageTag: string,
	containerName: string,
	signal: AbortSignal,
	progress: Progress,
) => {
	await ensureNetwork();
	await run("docker", ["rm", "-f", containerName]).catch(() => "");
	const args = [
		"run",
		"-d",
		"--name",
		containerName,
		"--network",
		config.dockerNetwork,
		"--label",
		"com.dequel.managed=true",
		"--publish",
		String(spec.appPort),
		"--env",
		`PORT=${spec.appPort}`,
	];
	if (spec.projectId) {
		args.push("--label", `com.dequel.project=${spec.projectId}`);
		args.push("--label", `com.dequel.deployment=${spec.deploymentId}`);
	}
	if (spec.cpuLimit) args.push("--cpus", String(spec.cpuLimit));
	if (spec.memoryLimitMb) args.push("--memory", `${Math.round(spec.memoryLimitMb)}m`);
	for (const env of spec.environmentVariables) args.push("--env", `${env.key}=${env.value}`);
	if (spec.volumes && spec.volumes.length > 0) {
		for (const vol of spec.volumes) {
			await run("docker", ["volume", "create", vol.volumeName]).catch(() => "");
			args.push("--volume", `${vol.volumeName}:${vol.mountPath}`);
		}
	} else if (spec.projectId) {
		const defaultVolume = `vol-${spec.projectId.slice(0, 12)}`;
		await run("docker", ["volume", "create", defaultVolume]).catch(() => "");
		args.push("--volume", `${defaultVolume}:/app/data`);
	}
	args.push(imageTag);
	progress("deploy", `Starting container ${containerName}`);
	await run("docker", args, { signal });
	await Bun.sleep(2_000);
	const status = await run("docker", ["inspect", "--format", "{{.State.Status}}", containerName], { signal });
	if (status.trim() !== "running") {
		const logs = await run("docker", ["logs", "--tail", "100", containerName]).catch(
			() => "No container logs available",
		);
		throw new Error(`Container failed to remain running: ${logs}`);
	}
	const portOutput = await run("docker", ["port", containerName, `${spec.appPort}/tcp`], { signal });
	const match = portOutput.match(/:(\d+)\s*$/m);
	if (!match) throw new Error("Docker did not publish an application port");
	const hostPort = Number(match[1]);
	if (spec.projectId) {
		const previous = (
			await run("docker", ["ps", "-aq", "--filter", `label=com.dequel.project=${spec.projectId}`], { signal })
		)
			.split("\n")
			.map((id) => id.trim())
			.filter(Boolean);
		const currentId = await run("docker", ["inspect", "--format", "{{.Id}}", containerName], { signal });
		for (const id of previous) if (id !== currentId) await run("docker", ["rm", "-f", id]).catch(() => "");
	}
	return hostPort;
};

const deployFromGit = async (
	payload: RemoteGitDeployPayload,
	signal: AbortSignal,
	progress: Progress,
): Promise<RemoteDeployResult> => {
	const workspace = join(config.workspaceRoot, payload.deploymentId);
	const slug = slugify(payload.projectName);
	const imageTag = `dequel-${slug}:${payload.deploymentId.slice(0, 12)}`;
	const containerName = `${slug}-${payload.deploymentId.slice(0, 8)}`;
	try {
		const commitSha = await prepareSource(payload, workspace, signal, progress);
		await buildImage(payload, workspace, imageTag, signal, progress);
		const hostPort = await startContainer(payload, imageTag, containerName, signal, progress);
		const liveUrl = config.publicHost ? `http://${config.publicHost}:${hostPort}` : null;
		progress("deploy", liveUrl ? `Deployment reachable at ${liveUrl}` : `Container published on host port ${hostPort}`);
		return { imageTag, containerName, hostPort, liveUrl, commitSha };
	} catch (error) {
		await run("docker", ["rm", "-f", containerName]).catch(() => "");
		throw error;
	} finally {
		await rm(workspace, { recursive: true, force: true }).catch(() => {});
	}
};

const rollbackToImage = async (
	payload: RemoteRollbackPayload,
	signal: AbortSignal,
	progress: Progress,
): Promise<RemoteDeployResult> => {
	const slug = slugify(payload.projectName || payload.deploymentId);
	const containerName = `${slug}-${payload.deploymentId.slice(0, 8)}`;
	const hostPort = await startContainer(payload, payload.imageTag, containerName, signal, progress);
	const liveUrl = config.publicHost ? `http://${config.publicHost}:${hostPort}` : null;
	progress(
		"deploy",
		liveUrl ? `Rollback reachable at ${liveUrl}` : `Rollback container published on host port ${hostPort}`,
	);
	return { imageTag: payload.imageTag, containerName, hostPort, liveUrl, commitSha: null };
};

const destroyDeployment = async (payload: RemoteDestroyPayload, progress: Progress) => {
	if (payload.containerName) {
		await run("docker", ["rm", "-f", payload.containerName]).catch(() => "");
	}
	if (payload.imageTag) {
		await run("docker", ["rmi", "-f", payload.imageTag]).catch(() => "");
	}
	progress("deploy", "Container and image removed");
	return { ok: true as const };
};

const scaleDeployment = async (payload: RemoteScalePayload, signal: AbortSignal, progress: Progress) => {
	await ensureNetwork();
	const containerName = `deploy-${payload.deploymentId}-replica-${payload.replicas}`;
	if (payload.action === "down") {
		await run("docker", ["rm", "-f", containerName]).catch(() => "");
		progress("deploy", `Replica ${containerName} removed`);
		return { replicas: payload.replicas, removed: true as const };
	}
	const args = [
		"run",
		"-d",
		"--name",
		containerName,
		"--network",
		config.dockerNetwork,
		"--label",
		"com.dequel.managed=true",
		"--label",
		"com.dequel.replica=1",
		"--label",
		`com.dequel.deployment=${payload.deploymentId}`,
		"--publish",
		String(payload.appPort),
		"--env",
		`PORT=${payload.appPort}`,
	];
	if (payload.projectId) args.push("--label", `com.dequel.project=${payload.projectId}`);
	if (payload.cpuLimit) args.push("--cpus", String(payload.cpuLimit));
	if (payload.memoryLimitMb) args.push("--memory", `${Math.round(payload.memoryLimitMb)}m`);
	for (const env of payload.environmentVariables) args.push("--env", `${env.key}=${env.value}`);
	args.push(payload.imageTag);
	progress("deploy", `Starting replica ${containerName}`);
	await run("docker", args, { signal });
	await Bun.sleep(2_000);
	const status = await run("docker", ["inspect", "--format", "{{.State.Status}}", containerName], { signal });
	if (status.trim() !== "running") {
		const logs = await run("docker", ["logs", "--tail", "100", containerName]).catch(
			() => "No container logs available",
		);
		throw new Error(`Replica failed to remain running: ${logs}`);
	}
	progress("deploy", `Replica ${containerName} running`);
	return { replicas: payload.replicas, started: true as const };
};

export const executeJob = async (
	job: AgentJobEnvelope,
	signal: AbortSignal,
	progress: Progress,
): Promise<RemoteDeployResult | RemoteRouteResult | RemoteScaleResult | { ok: true }> => {
	switch (job.type) {
		case "deploy":
			return deployFromGit(validateDeploymentPayload(job.payload), signal, progress);
		case "rollback":
			return rollbackToImage(validateRollbackPayload(job.payload), signal, progress);
		case "destroy":
			return destroyDeployment(validateDestroyPayload(job.payload), progress);
		case "scale":
			return scaleDeployment(validateScalePayload(job.payload), signal, progress);
		case "reload_routes":
			return applyRoute(validateRoutePayload(job.payload), signal);
		default:
			throw new Error(`Agent executor does not support ${job.type} jobs yet`);
	}
};

const reloadCaddyContainer = async () => {
	const ps = await run("docker", [
		"ps",
		"-q",
		"--filter",
		"label=com.docker.compose.service=caddy",
		"--filter",
		`network=${config.dockerNetwork}`,
	]).catch(() => "");
	const caddyId = ps
		.split("\n")
		.map((l) => l.trim())
		.find(Boolean);
	if (!caddyId) return;
	await run("docker", ["exec", caddyId, "caddy", "reload", "--config", "/etc/caddy/Caddyfile"]);
};

const applyRoute = async (payload: RemoteRoutePayload, _signal: AbortSignal): Promise<RemoteRouteResult> => {
	const routesDir = config.caddyRoutesDir;
	await mkdir(routesDir, { recursive: true });
	const filePath = join(routesDir, payload.routeFile);
	if (payload.action === "remove") {
		await rm(filePath, { force: true });
	} else if (payload.upstreamHost) {
		const snippet = `${payload.hostname} {\n  reverse_proxy ${payload.upstreamHost}:80\n}\n`;
		await writeFile(filePath, snippet, "utf8");
	} else {
		const targets = payload.targetContainers.map((c) => `${c}:${payload.port}`).join(" ");
		const snippet = `${payload.hostname} {\n  reverse_proxy ${targets} {\n    header_up Host {upstream_hostport}\n  }\n}\n`;
		await writeFile(filePath, snippet, "utf8");
	}
	await reloadCaddyContainer().catch(() => {});
	return { routeFile: payload.routeFile, status: payload.action === "add" ? "active" : "removed" };
};
