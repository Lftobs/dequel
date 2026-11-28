import type { HealthCheckConfig, Server } from "../types";
import { dockerBin } from "../utils/docker-bin";
import { dockerRun, dockerRunTry } from "../utils/docker-run";

export const DEFAULT_HEALTH_INTERVAL = 10;
export const DEFAULT_HEALTH_TIMEOUT = 3;
export const DEFAULT_HEALTH_RETRIES = 3;
export const DEFAULT_HEALTH_START_PERIOD = 5;

export const buildHealthCheckArgs = (healthCheck: HealthCheckConfig | null | undefined, appPort: number): string[] => {
	if (!healthCheck || healthCheck.type === "none") return [];
	const port = healthCheck.port ?? appPort;
	let command: string | null = null;
	if (healthCheck.type === "http") {
		const path = healthCheck.path?.trim() || "/";
		const normalized = path.startsWith("/") ? path : `/${path}`;
		command = `wget -q -O /dev/null http://127.0.0.1:${port}${normalized} || curl -fsS http://127.0.0.1:${port}${normalized} >/dev/null`;
	} else if (healthCheck.type === "tcp") {
		command = `nc -z 127.0.0.1 ${port} || (echo > /dev/tcp/127.0.0.1/${port})`;
	} else if (healthCheck.type === "command") {
		command = healthCheck.command?.trim() || null;
	}
	if (!command) return [];
	const interval = Math.max(1, healthCheck.intervalSeconds ?? DEFAULT_HEALTH_INTERVAL);
	const timeout = Math.max(1, healthCheck.timeoutSeconds ?? DEFAULT_HEALTH_TIMEOUT);
	const retries = Math.max(1, healthCheck.retries ?? DEFAULT_HEALTH_RETRIES);
	const startPeriod = Math.max(0, healthCheck.startPeriodSeconds ?? DEFAULT_HEALTH_START_PERIOD);
	return [
		"--health-cmd",
		command,
		"--health-interval",
		`${interval}s`,
		"--health-timeout",
		`${timeout}s`,
		"--health-retries",
		String(retries),
		"--health-start-period",
		`${startPeriod}s`,
	];
};

export const buildRestartArgs = (
	policy: string | null | undefined,
	maxRetries: number | null | undefined,
	stopGraceSeconds: number | null | undefined,
): string[] => {
	const args: string[] = [];
	if (policy && policy !== "no") {
		const value = policy === "on-failure" && maxRetries && maxRetries > 0 ? `on-failure:${maxRetries}` : policy;
		args.push("--restart", value);
	}
	if (stopGraceSeconds !== null && stopGraceSeconds !== undefined && stopGraceSeconds >= 0) {
		args.push("--stop-timeout", String(Math.floor(stopGraceSeconds)));
	}
	return args;
};

const inspectHealth = async (containerName: string, server?: Server | null) => {
	const status = await dockerRun(
		dockerBin,
		["inspect", "-f", "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}", containerName],
		server,
	)
		.then((value) => value.trim())
		.catch(() => "none");
	const running = await dockerRun(dockerBin, ["inspect", "-f", "{{.State.Status}}", containerName], server)
		.then((value) => value.trim())
		.catch(() => "missing");
	return { status, running };
};

export const waitForHealthyContainer = async (
	containerName: string,
	healthCheck: HealthCheckConfig,
	onLog: (line: string) => Promise<void>,
	server?: Server | null,
): Promise<void> => {
	if (!healthCheck || healthCheck.type === "none") return;
	const interval = Math.max(1, healthCheck.intervalSeconds ?? DEFAULT_HEALTH_INTERVAL);
	const retries = Math.max(1, healthCheck.retries ?? DEFAULT_HEALTH_RETRIES);
	const startPeriod = Math.max(0, healthCheck.startPeriodSeconds ?? DEFAULT_HEALTH_START_PERIOD);
	const timeoutMs = Math.min((startPeriod + interval * (retries + 2)) * 1000 + 15_000, 10 * 60 * 1000);
	const deadline = Date.now() + timeoutMs;
	await onLog(`Waiting for health check (${healthCheck.type}) on ${containerName}`);
	let lastStatus = "unknown";
	while (Date.now() < deadline) {
		const { status, running } = await inspectHealth(containerName, server);
		lastStatus = status;
		if (running === "exited") {
			const logs = await dockerRunTry(dockerBin, ["logs", "--tail", "50", containerName], server);
			throw new Error(`Container exited while waiting for health check. Logs:\n${(logs ?? "").trim() || "*No logs*"}`);
		}
		if (status === "healthy") {
			await onLog(`Health check passed for ${containerName}`);
			return;
		}
		if (status === "unhealthy") {
			const details = await dockerRunTry(
				dockerBin,
				["inspect", "-f", "{{range .State.Health.Log}}{{.Output}}{{end}}", containerName],
				server,
			);
			throw new Error(`Health check failed for ${containerName}.\n${(details ?? "").trim()}`);
		}
		await new Promise((resolve) => setTimeout(resolve, Math.min(interval, 5) * 1000));
	}
	const details = await dockerRunTry(dockerBin, ["inspect", "-f", "{{json .State.Health}}", containerName], server);
	throw new Error(
		`Health check did not become healthy within ${Math.round(timeoutMs / 1000)}s (last: ${lastStatus}).\n${details ?? ""}`,
	);
};
