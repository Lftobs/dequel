import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config";
import type { AgentJobEnvelope } from "./protocol";

export type RemoteGitDeployPayload = {
	deploymentId: string;
	projectId: string;
	projectName: string;
	gitUrl: string;
	branch?: string;
	commitSha?: string;
	appPort: number;
	cpuLimit?: number;
	memoryLimitMb?: number;
	environmentVariables: { key: string; value: string }[];
};

export type RemoteRollbackPayload = {
	deploymentId: string;
	projectId: string | null;
	projectName: string | null;
	imageTag: string;
	appPort: number;
	cpuLimit?: number | null;
	memoryLimitMb?: number | null;
	environmentVariables: { key: string; value: string }[];
	volumes?: { volumeName: string; mountPath: string }[];
};

export type RemoteDestroyPayload = {
	deploymentId: string;
	containerName: string | null;
	imageTag: string | null;
};

export type RemoteScalePayload = {
	deploymentId: string;
	projectId: string | null;
	action: "up" | "down";
	replicas: number;
	imageTag: string;
	appPort: number;
	cpuLimit?: number | null;
	memoryLimitMb?: number | null;
	environmentVariables: { key: string; value: string }[];
};

export type RemoteRoutePayload = {
	deploymentId: string | null;
	action: "add" | "remove";
	hostname: string;
	routeFile: string;
	port: number;
	targetContainers: string[];
	upstreamHost?: string;
};

export type RemoteRouteResult = {
	routeFile: string;
	status: "active" | "removed";
};

export type RemoteDeployResult = {
	imageTag: string;
	containerName: string;
	hostPort: number;
	liveUrl: string | null;
	commitSha: string | null;
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

const ID_RE = /^[a-zA-Z0-9-]{1,100}$/;
const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SHA_RE = /^[0-9a-f]{7,40}$/i;
const IMAGE_TAG_RE = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*:[a-zA-Z0-9._-]+$/;
const VOLUME_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const MOUNT_PATH_RE = /^\/(?:[a-zA-Z0-9._-]+\/?)+$/;
const HOSTNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?(?::\d{1,5})?$/;
const ROUTE_FILE_RE = /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.caddy$/;
const UPSTREAM_HOST_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?(?::\d{1,5})?$/;

const run = (
	command: string,
	args: string[],
	options: { cwd?: string; signal?: AbortSignal; onLine?: (line: string) => void; timeoutMs?: number } = {},
) =>
	new Promise<string>((resolve, reject) => {
		const child = spawn(command, args, { cwd: options.cwd, signal: options.signal, stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		let buffer = "";
		const emit = (chunk: unknown) => {
			const text = String(chunk);
			buffer += text;
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";
			for (const line of lines) if (line.trim()) options.onLine?.(line.trim());
		};
		child.stdout.on("data", (chunk) => {
			stdout += String(chunk);
			emit(chunk);
		});
		child.stderr.on("data", (chunk) => {
			stderr += String(chunk);
			emit(chunk);
		});
		const timeout = options.timeoutMs ? setTimeout(() => child.kill("SIGTERM"), options.timeoutMs) : null;
		child.on("error", (error) => {
			if (timeout) clearTimeout(timeout);
			reject(error);
		});
		child.on("close", (code) => {
			if (timeout) clearTimeout(timeout);
			if (buffer.trim()) options.onLine?.(buffer.trim());
			if (code === 0) resolve(stdout.trim());
			else reject(new Error(`${command} failed (${code}): ${(stderr || stdout).trim()}`));
		});
	});

const validatePayload = (value: unknown): RemoteGitDeployPayload => {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Deployment payload must be an object");
	const input = value as Record<string, unknown>;
	if (typeof input.deploymentId !== "string" || !ID_RE.test(input.deploymentId))
		throw new Error("Invalid deployment ID");
	if (typeof input.projectId !== "string" || !ID_RE.test(input.projectId)) throw new Error("Invalid project ID");
	if (typeof input.projectName !== "string" || !input.projectName.trim()) throw new Error("Invalid project name");
	if (typeof input.gitUrl !== "string") throw new Error("Invalid Git URL");
	const gitUrl = new URL(input.gitUrl);
	if (gitUrl.protocol !== "https:" || gitUrl.username || gitUrl.password)
		throw new Error("Only public HTTPS Git URLs are supported");
	if (input.branch !== undefined && (typeof input.branch !== "string" || input.branch.startsWith("-")))
		throw new Error("Invalid Git branch");
	if (input.commitSha !== undefined && (typeof input.commitSha !== "string" || !SHA_RE.test(input.commitSha)))
		throw new Error("Invalid commit SHA");
	if (!Number.isInteger(input.appPort) || Number(input.appPort) < 1 || Number(input.appPort) > 65535)
		throw new Error("Invalid application port");
	if (input.cpuLimit !== undefined && (typeof input.cpuLimit !== "number" || input.cpuLimit <= 0))
		throw new Error("Invalid CPU limit");
	if (input.memoryLimitMb !== undefined && (typeof input.memoryLimitMb !== "number" || input.memoryLimitMb <= 0))
		throw new Error("Invalid memory limit");
	if (
		!Array.isArray(input.environmentVariables) ||
		input.environmentVariables.some(
			(item) =>
				!item ||
				typeof item !== "object" ||
				typeof item.key !== "string" ||
				!ENV_KEY_RE.test(item.key) ||
				typeof item.value !== "string",
		)
	)
		throw new Error("Invalid environment variables");
	return input as RemoteGitDeployPayload;
};

const validateRollbackPayloadImpl = (value: unknown): RemoteRollbackPayload => {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Rollback payload must be an object");
	const input = value as Record<string, unknown>;
	if (typeof input.deploymentId !== "string" || !ID_RE.test(input.deploymentId))
		throw new Error("Invalid deployment ID");
	if (input.projectId !== null && (typeof input.projectId !== "string" || !ID_RE.test(input.projectId)))
		throw new Error("Invalid project ID");
	if (input.projectName !== null && (typeof input.projectName !== "string" || !input.projectName.trim()))
		throw new Error("Invalid project name");
	if (typeof input.imageTag !== "string" || !IMAGE_TAG_RE.test(input.imageTag)) throw new Error("Invalid image tag");
	if (!Number.isInteger(input.appPort) || Number(input.appPort) < 1 || Number(input.appPort) > 65535)
		throw new Error("Invalid application port");
	if (
		input.cpuLimit !== undefined &&
		input.cpuLimit !== null &&
		(typeof input.cpuLimit !== "number" || input.cpuLimit <= 0)
	)
		throw new Error("Invalid CPU limit");
	if (
		input.memoryLimitMb !== undefined &&
		input.memoryLimitMb !== null &&
		(typeof input.memoryLimitMb !== "number" || input.memoryLimitMb <= 0)
	)
		throw new Error("Invalid memory limit");
	if (
		!Array.isArray(input.environmentVariables) ||
		input.environmentVariables.some(
			(item) =>
				!item ||
				typeof item !== "object" ||
				typeof item.key !== "string" ||
				!ENV_KEY_RE.test(item.key) ||
				typeof item.value !== "string",
		)
	)
		throw new Error("Invalid environment variables");
	if (
		input.volumes !== undefined &&
		(!Array.isArray(input.volumes) ||
			input.volumes.some(
				(v) =>
					!v ||
					typeof v !== "object" ||
					typeof v.volumeName !== "string" ||
					!VOLUME_NAME_RE.test(v.volumeName) ||
					typeof v.mountPath !== "string" ||
					!MOUNT_PATH_RE.test(v.mountPath),
			))
	)
		throw new Error("Invalid volumes");
	return input as RemoteRollbackPayload;
};

const validateDestroyPayloadImpl = (value: unknown): RemoteDestroyPayload => {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Destroy payload must be an object");
	const input = value as Record<string, unknown>;
	if (typeof input.deploymentId !== "string" || !ID_RE.test(input.deploymentId))
		throw new Error("Invalid deployment ID");
	if (input.containerName !== null && (typeof input.containerName !== "string" || !ID_RE.test(input.containerName)))
		throw new Error("Invalid container name");
	if (input.imageTag !== null && (typeof input.imageTag !== "string" || !IMAGE_TAG_RE.test(input.imageTag)))
		throw new Error("Invalid image tag");
	return input as RemoteDestroyPayload;
};

const validateScalePayloadImpl = (value: unknown): RemoteScalePayload => {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Scale payload must be an object");
	const input = value as Record<string, unknown>;
	if (typeof input.deploymentId !== "string" || !ID_RE.test(input.deploymentId))
		throw new Error("Invalid deployment ID");
	if (input.projectId !== null && (typeof input.projectId !== "string" || !ID_RE.test(input.projectId)))
		throw new Error("Invalid project ID");
	if (input.action !== "up" && input.action !== "down") throw new Error("Invalid scale action");
	if (!Number.isInteger(input.replicas) || Number(input.replicas) < 1 || Number(input.replicas) > 50)
		throw new Error("Invalid replica count");
	if (typeof input.imageTag !== "string" || !IMAGE_TAG_RE.test(input.imageTag)) throw new Error("Invalid image tag");
	if (!Number.isInteger(input.appPort) || Number(input.appPort) < 1 || Number(input.appPort) > 65535)
		throw new Error("Invalid application port");
	if (
		input.cpuLimit !== undefined &&
		input.cpuLimit !== null &&
		(typeof input.cpuLimit !== "number" || input.cpuLimit <= 0)
	)
		throw new Error("Invalid CPU limit");
	if (
		input.memoryLimitMb !== undefined &&
		input.memoryLimitMb !== null &&
		(typeof input.memoryLimitMb !== "number" || input.memoryLimitMb <= 0)
	)
		throw new Error("Invalid memory limit");
	if (
		!Array.isArray(input.environmentVariables) ||
		input.environmentVariables.some(
			(item) =>
				!item ||
				typeof item !== "object" ||
				typeof item.key !== "string" ||
				!ENV_KEY_RE.test(item.key) ||
				typeof item.value !== "string",
		)
	)
		throw new Error("Invalid environment variables");
	return input as RemoteScalePayload;
};

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

export type RemoteScaleResult = { replicas: number; removed: true } | { replicas: number; started: true };

export const executeJob = async (
	job: AgentJobEnvelope,
	signal: AbortSignal,
	progress: Progress,
): Promise<RemoteDeployResult | RemoteRouteResult | RemoteScaleResult | { ok: true }> => {
	switch (job.type) {
		case "deploy":
			return deployFromGit(validatePayload(job.payload), signal, progress);
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

export const validateDeploymentPayload = validatePayload;
export const validateRollbackPayload = validateRollbackPayloadImpl;
export const validateDestroyPayload = validateDestroyPayloadImpl;
export const validateScalePayload = validateScalePayloadImpl;

const validateRoutePayloadImpl = (value: unknown): RemoteRoutePayload => {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Route payload must be an object");
	const input = value as Record<string, unknown>;
	if (typeof input.deploymentId !== "string" && input.deploymentId !== null) throw new Error("Invalid deployment ID");
	if (input.action !== "add" && input.action !== "remove") throw new Error("Invalid route action");
	if (typeof input.hostname !== "string" || !HOSTNAME_RE.test(input.hostname)) throw new Error("Invalid hostname");
	if (typeof input.routeFile !== "string" || !ROUTE_FILE_RE.test(input.routeFile))
		throw new Error("Invalid route file name");
	if (!Number.isInteger(input.port) || Number(input.port) < 1 || Number(input.port) > 65535)
		throw new Error("Invalid application port");
	if (
		input.upstreamHost !== undefined &&
		(typeof input.upstreamHost !== "string" || !UPSTREAM_HOST_RE.test(input.upstreamHost))
	) {
		throw new Error("Invalid upstream host");
	}
	if (
		!Array.isArray(input.targetContainers) ||
		input.targetContainers.some((c) => typeof c !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(c))
	) {
		throw new Error("Invalid target containers");
	}
	if (input.action === "add" && input.targetContainers.length === 0 && !input.upstreamHost) {
		throw new Error("Target containers required for add action without upstream host");
	}
	return input as RemoteRoutePayload;
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

export const validateRoutePayload = validateRoutePayloadImpl;
