import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || `${homedir()}/.config`;

export interface FileConfig {
	CADDY_BASE_DOMAIN?: string;
	CONTROL_PLANE_URL?: string;
	AGENT_TUNNEL_URL?: string;
	QUEUE_CONCURRENCY?: number;
	QUEUE_RETRY_MAX?: number;
	QUEUE_RETRY_BASE_MS?: number;
	ALERT_EVAL_INTERVAL_MS?: number;
	FAILURE_SWEEP_INTERVAL_MS?: number;
	GRAFANA_URL?: string;
	GRAFANA_USER?: string;
	GRAFANA_PASS?: string;
	WIREGUARD_SERVER_CONTAINER?: string;
	WIREGUARD_SERVER_PUBLIC_KEY?: string;
	WIREGUARD_SERVER_ENDPOINT?: string;
	WIREGUARD_SERVER_IP?: string;
	WIREGUARD_PEER_CIDR?: string;
	FAILOVER_DISABLED?: string;
	FAILOVER_MIN_INTERVAL_MS?: number;
}

const searchPaths = (): string[] => {
	const explicit = process.env.DEQUEL_CONFIG;
	if (explicit) return [resolve(explicit)];
	return [resolve(`${XDG_CONFIG_HOME}/dequel/dequel.json`), resolve("./dequel.json"), resolve("./data/dequel.json")];
};

export const loadFileConfig = (): FileConfig => {
	for (const path of searchPaths()) {
		if (existsSync(path)) {
			try {
				const raw = readFileSync(path, "utf-8");
				const parsed = JSON.parse(raw) as FileConfig;
				console.log(`[Config] Loaded config from ${path}`);
				return parsed;
			} catch (err) {
				console.warn(`[Config] Failed to parse ${path}:`, err);
			}
		}
	}
	return {};
};
