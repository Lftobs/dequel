import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { dockerBin } from "../utils/docker-bin";

export interface ComposeTarget {
	serviceName: string;
	port: number;
}

export const findComposeFilePath = (workspacePath: string, sourceDir?: string | null): string | null => {
	const base = sourceDir ? join(workspacePath, sourceDir.replace(/^\//, "")) : workspacePath;
	const ymlPath = join(base, "docker-compose.yml");
	if (existsSync(ymlPath)) return ymlPath;
	const yamlPath = join(base, "docker-compose.yaml");
	if (existsSync(yamlPath)) return yamlPath;
	return null;
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

	const content = readFileSync(composeFile, "utf-8");
	const lines = content.split("\n");

	let currentService = "";
	const servicePorts: Record<string, number> = {};
	const servicesList: string[] = [];

	let inServicesBlock = false;
	let inPortsBlock = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		// Check if entering services block
		if (line.match(/^services:/)) {
			inServicesBlock = true;
			continue;
		}

		// Top level block exit
		if (line.match(/^[a-zA-Z0-9_-]+:/) && !line.startsWith("services:")) {
			inServicesBlock = false;
			currentService = "";
		}

		if (!inServicesBlock) continue;

		// Service declaration under services: (2 spaces indentation)
		const serviceMatch = line.match(/^  ([a-zA-Z0-9_-]+):/);
		if (serviceMatch) {
			currentService = serviceMatch[1];
			servicesList.push(currentService);
			inPortsBlock = false;
			continue;
		}

		if (currentService) {
			// Check if entering ports block
			if (line.match(/^\s+ports:/)) {
				inPortsBlock = true;
				// Inline array syntax: ports: ["8080:80"] or ports: [3000]
				const inlineMatch = trimmed.match(/ports:\s*\[\s*["']?(\d+)(?::(\d+))?["']?\s*\]/i);
				if (inlineMatch) {
					const target = inlineMatch[2] || inlineMatch[1];
					servicePorts[currentService] = Number(target);
					inPortsBlock = false;
				}
				continue;
			}

			// Port item under ports block
			if (inPortsBlock && line.match(/^\s+-\s*/)) {
				const portMatch = trimmed.match(/-\s*["']?(\d+)(?::(\d+))?["']?/);
				if (portMatch) {
					const targetPort = portMatch[2] || portMatch[1];
					if (!servicePorts[currentService]) {
						servicePorts[currentService] = Number(targetPort);
					}
				}
			} else if (line.match(/^\s+[a-zA-Z0-9_-]+:/)) {
				inPortsBlock = false;
			}
		}
	}

	let targetService = preferredService?.trim() || "";
	let targetPort = preferredPort || 0;

	if (!targetService) {
		const commonNames = ["web", "frontend", "client", "app", "server", "api"];
		for (const name of commonNames) {
			if (servicesList.includes(name)) {
				targetService = name;
				break;
			}
		}
		if (!targetService && servicesList.length > 0) {
			targetService = servicesList[0];
		}
	}

	if (!targetService) {
		throw new Error("Could not detect any services in docker-compose.yml.");
	}

	if (!targetPort) {
		targetPort = servicePorts[targetService] || 3000;
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
	const composeFile = findComposeFilePath(workspacePath, sourceDir);
	if (!composeFile) return [{ ...primaryTarget, isPrimary: true }];

	const content = readFileSync(composeFile, "utf-8");
	const lines = content.split("\n");

	let currentService = "";
	const servicePorts: Record<string, number> = {};
	const servicesList: string[] = [];

	let inServicesBlock = false;
	let inPortsBlock = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		if (line.match(/^services:/)) {
			inServicesBlock = true;
			continue;
		}

		if (line.match(/^[a-zA-Z0-9_-]+:/) && !line.startsWith("services:")) {
			inServicesBlock = false;
			currentService = "";
		}

		if (!inServicesBlock) continue;

		const serviceMatch = line.match(/^  ([a-zA-Z0-9_-]+):/);
		if (serviceMatch) {
			currentService = serviceMatch[1];
			servicesList.push(currentService);
			inPortsBlock = false;
			continue;
		}

		if (currentService) {
			if (line.match(/^\s+ports:/)) {
				inPortsBlock = true;
				const inlineMatch = trimmed.match(/ports:\s*\[\s*["']?(\d+)(?::(\d+))?["']?\s*\]/i);
				if (inlineMatch) {
					const target = inlineMatch[2] || inlineMatch[1];
					servicePorts[currentService] = Number(target);
					inPortsBlock = false;
				}
				continue;
			}

			if (inPortsBlock && line.match(/^\s+-\s*/)) {
				const portMatch = trimmed.match(/-\s*["']?(\d+)(?::(\d+))?["']?/);
				if (portMatch) {
					const targetPort = portMatch[2] || portMatch[1];
					if (!servicePorts[currentService]) {
						servicePorts[currentService] = Number(targetPort);
					}
				}
			} else if (line.match(/^\s+[a-zA-Z0-9_-]+:/)) {
				inPortsBlock = false;
			}
		}
	}

	const results: ComposeService[] = [];
	for (const service of servicesList) {
		const isPrimary = service === primaryTarget.serviceName;
		const port = isPrimary ? primaryTarget.port : (servicePorts[service] || 3000);
		results.push({
			serviceName: service,
			port,
			isPrimary,
		});
	}

	if (results.length === 0) {
		results.push({ ...primaryTarget, isPrimary: true });
	}

	return results;
};

const spawnComposeCommand = (
	args: string[],
	cwd: string,
	envVars?: Record<string, string>,
	onLog?: (line: string) => Promise<void>,
): Promise<{ code: number; stdout: string; stderr: string }> => {
	return new Promise((resolve, reject) => {
		const child = spawn(dockerBin, ["compose", ...args], {
			cwd,
			env: { ...process.env, ...(envVars || {}) },
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (chunk) => {
			const str = String(chunk);
			stdout += str;
			if (onLog) {
				for (const line of str.split("\n").map((l) => l.trim()).filter(Boolean)) {
					void onLog(line);
				}
			}
		});

		child.stderr.on("data", (chunk) => {
			const str = String(chunk);
			stderr += str;
			if (onLog) {
				for (const line of str.split("\n").map((l) => l.trim()).filter(Boolean)) {
					void onLog(line);
				}
			}
		});

		child.on("error", reject);
		child.on("close", (code) => {
			resolve({ code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() });
		});
	});
};

export const buildWithCompose = async (
	workspacePath: string,
	projectName: string,
	onLog: (line: string) => Promise<void>,
	sourceDir?: string | null,
	envVars?: Record<string, string>,
): Promise<void> => {
	const composeFile = findComposeFilePath(workspacePath, sourceDir);
	if (!composeFile) {
		throw new Error("No docker-compose.yml found in workspace.");
	}

	const cwd = sourceDir ? join(workspacePath, sourceDir.replace(/^\//, "")) : workspacePath;
	await onLog(`Starting Docker Compose build (project: ${projectName})...`);

	const res = await spawnComposeCommand(["-f", composeFile, "-p", projectName, "build"], cwd, envVars, onLog);
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
): Promise<void> => {
	const composeFile = findComposeFilePath(workspacePath, sourceDir);
	if (!composeFile) {
		throw new Error("No docker-compose.yml found in workspace.");
	}

	const cwd = sourceDir ? join(workspacePath, sourceDir.replace(/^\//, "")) : workspacePath;
	await onLog(`Starting Docker Compose services (project: ${projectName})...`);

	const res = await spawnComposeCommand(["-f", composeFile, "-p", projectName, "up", "-d"], cwd, envVars, onLog);
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

export const getComposeContainerNames = async (
	projectName: string,
): Promise<Map<string, string>> => {
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

const runDocker = (
	args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> => {
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
