import { loadFileConfig } from "./config-loader";
import { DEFAULT_ENV_ENCRYPTION_KEY } from "./crypto";

const fileConfig = loadFileConfig();

const withFile = <T>(key: string, envDefault: string, transform?: (v: string) => T): T => {
	const envVal = process.env[key];
	if (envVal !== undefined) {
		return transform ? transform(envVal) : (envVal as unknown as T);
	}
	const fileVal = (fileConfig as Record<string, unknown>)[key];
	if (fileVal !== undefined) return fileVal as T;
	return transform ? transform(envDefault) : (envDefault as unknown as T);
};

const withEnv = <T>(key: string, envDefault: string, transform?: (v: string) => T): T => {
	const envVal = process.env[key];
	if (envVal !== undefined) {
		return transform ? transform(envVal) : (envVal as unknown as T);
	}
	return transform ? transform(envDefault) : (envDefault as unknown as T);
};

const SYSTEM = {
	dockerNetwork: "dequel_net",
	buildkitHost: "tcp://buildkit:1234",
	redisUrl: "redis://redis:6379",
	dequelSourceRepoUrl: "https://github.com/Lftobs/dequel.git",
	workspaceRoot: "/app/workspace",
	caddyRoutesDir: "/caddy/routes",
	caddyDataDir: "/caddy-data/caddy",
	port: 3001,
	appInternalPort: 3000,
	gatewayCertDir: "/app/data",
	dequelSlackWebhookUrl: "",
	dequelSlackChannel: "",
} as const;

export const config = {
	...SYSTEM,
	databaseUrl: withEnv<string>("DATABASE_URL", ""),
	caddyBaseDomain: withFile<string>("CADDY_BASE_DOMAIN", "localhost"),
	controlPlaneUrl: withFile<string>("CONTROL_PLANE_URL", ""),
	agentTunnelUrl: withFile<string>("AGENT_TUNNEL_URL", ""),
	envEncryptionKey: withEnv<string>("ENV_ENCRYPTION_KEY", DEFAULT_ENV_ENCRYPTION_KEY),
	queueConcurrency: withFile<number>("QUEUE_CONCURRENCY", "3", Number),
	queueRetryMax: withFile<number>("QUEUE_RETRY_MAX", "5", Number),
	queueRetryBaseMs: withFile<number>("QUEUE_RETRY_BASE_MS", "5000", Number),
	alertEvalIntervalMs: withFile<number>("ALERT_EVAL_INTERVAL_MS", "60000", Number),
	failureSweepIntervalMs: withFile<number>("FAILURE_SWEEP_INTERVAL_MS", "60000", Number),
	grafanaUrl: withFile<string>("GRAFANA_URL", "http://grafana:3000"),
	grafanaUser: withFile<string>("GRAFANA_USER", "admin"),
	grafanaPass: withFile<string>("GRAFANA_PASS", "admin"),
	wireguardServerContainer: withFile<string>("WIREGUARD_SERVER_CONTAINER", ""),
	wireguardServerPublicKey: withFile<string>("WIREGUARD_SERVER_PUBLIC_KEY", ""),
	wireguardServerEndpoint: withFile<string>("WIREGUARD_SERVER_ENDPOINT", ""),
	wireguardServerIp: withFile<string>("WIREGUARD_SERVER_IP", "10.200.0.1"),
	wireguardPeerCidr: withFile<string>("WIREGUARD_PEER_CIDR", "10.200.0.0/24"),
	failoverDisabled: withFile<string>("FAILOVER_DISABLED", ""),
	failoverMinIntervalMs: withFile<number>("FAILOVER_MIN_INTERVAL_MS", "600000", Number),
};
