import { spawn } from "node:child_process";
import { listServerConnections, updateServerStatus } from "../db/repo";
import { getDockerSshTarget } from "../utils/ssh";

const run = (cmd: string, args: string[], timeoutMs = 10_000) =>
	new Promise<string>((resolve, reject) => {
		const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += String(chunk);
		});
		child.stderr.on("data", (chunk) => {
			stderr += String(chunk);
		});
		const timer = setTimeout(() => {
			child.kill();
			reject(new Error("timeout"));
		}, timeoutMs);
		child.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (code === 0) resolve(stdout.trim());
			else reject(new Error(`${cmd} ${args.join(" ")} failed (${code}): ${stderr}`));
		});
	});

const tryRun = (cmd: string, args: string[], timeoutMs?: number) => run(cmd, args, timeoutMs).catch(() => "");

const parseCpuPercent = (output: string): number | null => {
	const matches = [...output.matchAll(/([\d.]+)%/g)];
	if (matches.length === 0) return null;
	const total = matches.reduce((sum, m) => sum + parseFloat(m[1]), 0);
	return total;
};

class ServerManager {
	private interval: ReturnType<typeof setInterval> | null = null;
	private running = false;

	start() {
		if (this.interval) return;
		console.log("[Servers] Health check engine started");
		this.interval = setInterval(() => this.heartbeat(), 30_000);
	}

	stop() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	private async heartbeat() {
		if (this.running) return;
		this.running = true;
		try {
			const servers = await listServerConnections();
			for (const server of servers) {
				if (server.mode === "agent") continue;
				await this.checkServer(server);
			}
		} catch (err) {
			console.error("[Servers] Heartbeat error:", err);
		} finally {
			this.running = false;
		}
	}

	private async checkServer(server: {
		id: string;
		host: string;
		port: number;
		mode: string;
		sshUser?: string | null;
		sshKey?: string | null;
	}) {
		try {
			let dockerTarget = `unix:///var/run/docker.sock`;
			if (server.mode === "ssh") dockerTarget = getDockerSshTarget(server);
			else if (server.mode === "docker_tcp") dockerTarget = `tcp://${server.host}:${server.port || 2375}`;

			const info = await tryRun("docker", ["-H", dockerTarget, "info", "--format", "{{json .}}"]);
			if (!info) {
				await updateServerStatus(server.id, "disconnected");
				return;
			}

			const parsed = JSON.parse(info);
			let cpuUsedPercent: number | null = null;

			if (server.mode === "ssh" || server.mode === "docker_tcp") {
				const statsOutput = await tryRun(
					"docker",
					["-H", dockerTarget, "stats", "--no-stream", "--format", "{{.CPUPerc}}"],
					5_000,
				);
				const rawCpu = parseCpuPercent(statsOutput);
				if (rawCpu !== null && parsed.NCPU) {
					cpuUsedPercent = Math.round((rawCpu / parsed.NCPU) * 100) / 100;
				} else {
					cpuUsedPercent = rawCpu;
				}
			}

			const resources = {
				cpuTotal: parsed.NCPU ?? null,
				memoryTotalMb: parsed.MemTotal ? Math.floor(parsed.MemTotal / 1024 / 1024) : null,
				cpuUsedPercent,
				memoryUsedMb: null,
			};

			await updateServerStatus(server.id, "connected", resources);
		} catch {
			await updateServerStatus(server.id, "disconnected");
		}
	}
}

export const serverManager = new ServerManager();
