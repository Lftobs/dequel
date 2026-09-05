import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { dockerBin } from "../utils/docker-bin";
import { CancelledError } from "./railpack";

export interface ComposeTarget {
	serviceName: string;
	port: number;
}

export const resolveComposeDir = (workspacePath: string, sourceDir?: string | null): string | null => {
	let resolvedWorkspace: string;
	try {
		resolvedWorkspace = realpathSync(workspacePath);
	} catch {
		return null;
	}
	const candidate = sourceDir ? resolve(resolvedWorkspace, sourceDir.replace(/^\/+/, "")) : resolvedWorkspace;
	if (candidate !== resolvedWorkspace && !candidate.startsWith(resolvedWorkspace + sep)) {
		return null;
	}
	let realCandidate: string;
	try {
		realCandidate = realpathSync(candidate);
	} catch {
		return null;
	}
	if (realCandidate !== resolvedWorkspace && !realCandidate.startsWith(resolvedWorkspace + sep)) {
		return null;
	}
	return realCandidate;
};

export const findComposeFilePath = (workspacePath: string, sourceDir?: string | null): string | null => {
	const base = resolveComposeDir(workspacePath, sourceDir);
	if (!base) return null;
	const ymlPath = join(base, "docker-compose.yml");
	if (existsSync(ymlPath)) return ymlPath;
	const yamlPath = join(base, "docker-compose.yaml");
	if (existsSync(yamlPath)) return yamlPath;
	return null;
};

import { parse as parseYaml } from "yaml";

export interface ExtractedComposeService {
	serviceName: string;
	port: number | null;
}

export const parseContainerTargetPort = (entry: any): number | null => {
	if (typeof entry === "number") {
		return Number.isNaN(entry) || entry <= 0 ? null : entry;
	}
	if (typeof entry === "object" && entry !== null) {
		if ("target" in entry) {
			const num = Number(entry.target);
			return !Number.isNaN(num) && num > 0 ? num : null;
		}
	}
	if (typeof entry === "string") {
		let str = entry.trim().replace(/^["']|["']$/g, "");
		str = str.split("/")[0].trim();
		if (!str) return null;
		const parts = str.split(":");
		const lastPart = parts[parts.length - 1]?.trim();
		const num = Number(lastPart);
		return !Number.isNaN(num) && num > 0 ? num : null;
	}
	return null;
};

export const extractComposeServices = (workspacePath: string, sourceDir?: string | null): ExtractedComposeService[] => {
	const composeFile = findComposeFilePath(workspacePath, sourceDir);
	if (!composeFile) return [];

	const content = readFileSync(composeFile, "utf-8");
	let parsed: any;
	try {
		parsed = parseYaml(content);
	} catch {
		return [];
	}

	if (!parsed || typeof parsed !== "object" || !parsed.services || typeof parsed.services !== "object") {
		return [];
	}

	const result: ExtractedComposeService[] = [];
	const serviceEntries = Object.entries(parsed.services);

	for (const [serviceName, serviceConfig] of serviceEntries) {
		if (!serviceName) continue;
		let detectedPort: number | null = null;
		const configObj = serviceConfig && typeof serviceConfig === "object" ? serviceConfig : {};

		if (Array.isArray((configObj as any).ports)) {
			for (const portEntry of (configObj as any).ports) {
				const portNum = parseContainerTargetPort(portEntry);
				if (portNum !== null) {
					detectedPort = portNum;
					break;
				}
			}
		}

		result.push({
			serviceName,
			port: detectedPort,
		});
	}

	return result;
};

export const parseComposeTarget = (
	workspacePath: string,
	sourceDir?: string | null,
	preferredService?: string | null,
	preferredPort?: number | null,
): ComposeTarget => {
	const composeFile = findComposeFilePath(workspacePath, sourceDir);
	if (!composeFile) {
		throw new Error("No docker-compose.yml or docker-compose.yaml found in workspace.");
	}

	const services = extractComposeServices(workspacePath, sourceDir);
	if (services.length === 0) {
		throw new Error("Could not detect any services in docker-compose.yml.");
	}

	const serviceNames = services.map((s) => s.serviceName);
	const servicePortMap: Record<string, number | null> = {};
	for (const s of services) {
		servicePortMap[s.serviceName] = s.port;
	}

	let targetService = preferredService?.trim() || "";
	let targetPort = preferredPort || 0;

	if (!targetService) {
		const commonNames = ["web", "frontend", "client", "app", "server", "api"];
		for (const name of commonNames) {
			if (serviceNames.includes(name)) {
				targetService = name;
				break;
			}
		}
		if (!targetService && serviceNames.length > 0) {
			targetService = serviceNames[0];
		}
	}

	if (!targetService) {
		throw new Error("Could not detect any services in docker-compose.yml.");
	}

	if (!targetPort) {
		targetPort = servicePortMap[targetService] || 3000;
	}

	return {
		serviceName: targetService,
		port: targetPort,
	};
};

export interface ComposeService {
	serviceName: string;
	port: number;
	isPrimary: boolean;
}

export const parseAllComposeServices = (
	workspacePath: string,
	sourceDir?: string | null,
	preferredService?: string | null,
	preferredPort?: number | null,
): ComposeService[] => {
	const primaryTarget = parseComposeTarget(workspacePath, sourceDir, preferredService, preferredPort);
	const services = extractComposeServices(workspacePath, sourceDir);
	if (services.length === 0) {
		return [{ ...primaryTarget, isPrimary: true }];
	}

	return services.map((s) => ({
		serviceName: s.serviceName,
		port: s.serviceName === primaryTarget.serviceName ? primaryTarget.port : s.port || 3000,
		isPrimary: s.serviceName === primaryTarget.serviceName,
	}));
};

const spawnComposeCommand = (
	args: string[],
	cwd: string,
	envVars?: Record<string, string>,
	onLog?: (line: string) => Promise<void>,
	signal?: AbortSignal,
): Promise<{ code: number; stdout: string; stderr: string }> => {
	return new Promise((resolve, reject) => {
		const child = spawn(dockerBin, ["compose", ...args], {
			cwd,
			env: { ...process.env, ...(envVars || {}) },
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let settled = false;

		const finish = (result?: { code: number; stdout: string; stderr: string }, error?: Error) => {
			if (settled) return;
			settled = true;
			if (signal) {
				signal.removeEventListener("abort", onAbort);
			}
			if (error) {
				reject(error);
				return;
			}
			resolve(result!);
		};

		const onAbort = () => {
			child.kill("SIGTERM");
			finish(undefined, new CancelledError());
		};

		if (signal) {
			if (signal.aborted) {
				onAbort();
			} else {
				signal.addEventListener("abort", onAbort, { once: true });
			}
		}

		child.stdout.on("data", (chunk) => {
			const str = String(chunk);
			stdout += str;
			if (onLog) {
				for (const line of str
					.split("\n")
					.map((l) => l.trim())
					.filter(Boolean)) {
					void onLog(line);
				}
			}
		});

		child.stderr.on("data", (chunk) => {
			const str = String(chunk);
			stderr += str;
			if (onLog) {
				for (const line of str
					.split("\n")
					.map((l) => l.trim())
					.filter(Boolean)) {
					void onLog(line);
				}
			}
		});

		child.on("error", (err) => finish(undefined, err));
		child.on("close", (code) => {
			finish({ code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() });
		});
	});
};

export const buildWithCompose = async (
	workspacePath: string,
	projectName: string,
	onLog: (line: string) => Promise<void>,
	sourceDir?: string | null,
	envVars?: Record<string, string>,
	signal?: AbortSignal,
): Promise<void> => {
	const composeFile = findComposeFilePath(workspacePath, sourceDir);
	if (!composeFile) {
		throw new Error("No docker-compose.yml found in workspace.");
	}

	const cwd = dirname(composeFile);
	await onLog(`Starting Docker Compose build (project: ${projectName})...`);

	const res = await spawnComposeCommand(["-f", composeFile, "-p", projectName, "build"], cwd, envVars, onLog, signal);
	if (res.code !== 0) {
		throw new Error(`docker compose build failed: ${res.stderr || res.stdout}`);
	}

	await onLog("Docker Compose build completed successfully.");
};

export const deployWithCompose = async (
	workspacePath: string,
	projectName: string,
	onLog: (line: string) => Promise<void>,
	sourceDir?: string | null,
	envVars?: Record<string, string>,
	signal?: AbortSignal,
): Promise<void> => {
	const composeFile = findComposeFilePath(workspacePath, sourceDir);
	if (!composeFile) {
		throw new Error("No docker-compose.yml found in workspace.");
	}

	const cwd = dirname(composeFile);
	await onLog(`Starting Docker Compose services (project: ${projectName})...`);

	const res = await spawnComposeCommand(
		["-f", composeFile, "-p", projectName, "up", "-d"],
		cwd,
		envVars,
		onLog,
		signal,
	);
	if (res.code !== 0) {
		throw new Error(`docker compose up failed: ${res.stderr || res.stdout}`);
	}

	await onLog("Docker Compose stack started.");
};

export const destroyComposeStack = async (projectName: string): Promise<void> => {
	const filter = `label=com.docker.compose.project=${projectName}`;
	const ps = await runDocker(["ps", "-aq", "--filter", filter]);
	const ids = ps.stdout.split(/\s+/).filter(Boolean);
	for (const id of ids) {
		await runDocker(["rm", "-f", id]);
	}
	await runDocker(["network", "rm", `${projectName}_default`]).catch(() => {});
};

export const getComposeContainerNames = async (projectName: string): Promise<Map<string, string>> => {
	const res = await runDocker([
		"ps",
		"-a",
		"--filter",
		`label=com.docker.compose.project=${projectName}`,
		"--format",
		'{{.Label "com.docker.compose.service"}}|{{.Names}}',
	]);
	const map = new Map<string, string>();
	for (const line of res.stdout.split("\n")) {
		const [service, name] = line.split("|");
		if (service && name) map.set(service, name);
	}
	return map;
};

const runDocker = (args: string[]): Promise<{ code: number; stdout: string; stderr: string }> => {
	return new Promise((resolve, reject) => {
		const child = spawn(dockerBin, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (chunk) => {
			stdout += String(chunk);
		});

		child.stderr.on("data", (chunk) => {
			stderr += String(chunk);
		});

		child.on("error", reject);
		child.on("close", (code) => {
			resolve({ code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() });
		});
	});
};
