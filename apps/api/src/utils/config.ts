import { loadFileConfig } from "./config-loader";

const fileConfig = loadFileConfig();

const withFile = <T>(
	key: string,
	envDefault: string,
	transform?: (v: string) => T,
): T => {
	const envVal = process.env[key];
	if (envVal !== undefined) {
		return transform
			? transform(envVal)
			: (envVal as unknown as T);
	}
	const fileVal = (
		fileConfig as Record<string, unknown>
	)[key];
	if (fileVal !== undefined)
		return fileVal as T;
	return transform
		? transform(envDefault)
		: (envDefault as unknown as T);
};

const SYSTEM = {
	dockerNetwork: "dequel_net",
	buildkitHost: "tcp://buildkit:1234",
	redisUrl: "redis://redis:6379",
} as const;

export const config = {
	...SYSTEM,
	databasePath: withFile<string>("DATABASE_PATH", "/app/data/dequel.db"),
	workspaceRoot: withFile<string>("WORKSPACE_ROOT", "/app/workspace"),
	caddyRoutesDir: withFile<string>("CADDY_ROUTES_DIR", "/caddy/routes"),
	port: withFile<number>(
		"PORT",
		"17474",
		Number,
	),
	caddyBaseDomain: withFile<string>(
		"CADDY_BASE_DOMAIN",
		"localhost",
	),
	controlPlaneUrl: withFile<string>(
		"CONTROL_PLANE_URL",
		"",
	),
	agentTunnelUrl: withFile<string>(
		"AGENT_TUNNEL_URL",
		"",
	),
	appInternalPort: withFile<number>(
		"APP_INTERNAL_PORT",
		"17476",
		Number,
	),
	envEncryptionKey: withFile<string>(
		"ENV_ENCRYPTION_KEY",
		"dev-env-key-change-me",
	),
	queueConcurrency: withFile<number>(
		"QUEUE_CONCURRENCY",
		"3",
		Number,
	),
	queueRetryMax: withFile<number>(
		"QUEUE_RETRY_MAX",
		"5",
		Number,
	),
	queueRetryBaseMs: withFile<number>(
		"QUEUE_RETRY_BASE_MS",
		"5000",
		Number,
	),
	smtpHost: withFile<string>(
		"SMTP_HOST",
		"",
	),
	smtpPort: withFile<number>(
		"SMTP_PORT",
		"587",
		Number,
	),
	smtpUser: withFile<string>(
		"SMTP_USER",
		"",
	),
	smtpPass: withFile<string>(
		"SMTP_PASS",
		"",
	),
	smtpFrom: withFile<string>(
		"SMTP_FROM",
		"dequel@localhost",
	),
	alertEvalIntervalMs: withFile<number>(
		"ALERT_EVAL_INTERVAL_MS",
		"60000",
		Number,
	),
	githubClientId: withFile<string>(
		"GITHUB_CLIENT_ID",
		"",
	),
	githubClientSecret: withFile<string>(
		"GITHUB_CLIENT_SECRET",
		"",
	),
	githubAppName: withFile<string>(
		"GITHUB_APP_NAME",
		"Dequel",
	),
	githubWebhookSecret: withFile<string>(
		"GITHUB_WEBHOOK_SECRET",
		"",
	),
	grafanaUrl: withFile<string>(
		"GRAFANA_URL",
		"http://grafana:3000",
	),
	grafanaUser: withFile<string>(
		"GRAFANA_USER",
		"admin",
	),
	grafanaPass: withFile<string>(
		"GRAFANA_PASS",
		"admin",
	),
	wireguardServerContainer: withFile<string>(
		"WIREGUARD_SERVER_CONTAINER",
		"",
	),
	wireguardServerPublicKey: withFile<string>(
		"WIREGUARD_SERVER_PUBLIC_KEY",
		"",
	),
	wireguardServerEndpoint: withFile<string>(
		"WIREGUARD_SERVER_ENDPOINT",
		"",
	),
	wireguardServerIp: withFile<string>(
		"WIREGUARD_SERVER_IP",
		"10.200.0.1",
	),
	wireguardPeerCidr: withFile<string>(
		"WIREGUARD_PEER_CIDR",
		"10.200.0.0/24",
	),
};
