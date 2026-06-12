import { loadFileConfig, type FileConfig } from "./config-loader";

const fileConfig = loadFileConfig();

const withFile = <T>(
  key: string,
  envDefault: string,
  transform?: (v: string) => T,
): T => {
  const envVal = process.env[key];
  if (envVal !== undefined) {
    return transform ? transform(envVal) : (envVal as unknown as T);
  }
  const fileVal = (fileConfig as Record<string, unknown>)[key];
  if (fileVal !== undefined) return fileVal as T;
  return transform ? transform(envDefault) : (envDefault as unknown as T);
};

export const config = {
  port: withFile<number>("PORT", "3001", Number),
  databasePath: withFile<string>("DATABASE_PATH", "/app/data/dequel.db"),
  workspaceRoot: withFile<string>("WORKSPACE_ROOT", "/app/workspace"),
  caddyRoutesDir: withFile<string>("CADDY_ROUTES_DIR", "/caddy/routes"),
  caddyIngressBase: withFile<string>("CADDY_INGRESS_BASE", "http://localhost"),
  dockerNetwork: withFile<string>("DOCKER_NETWORK", "dequel_net"),
  appInternalPort: withFile<number>("APP_INTERNAL_PORT", "3000", Number),
  buildkitHost: withFile<string>("BUILDKIT_HOST", "tcp://buildkit:1234"),
  envEncryptionKey: withFile<string>("ENV_ENCRYPTION_KEY", "dev-env-key-change-me"),
  redisUrl: withFile<string>("REDIS_URL", "redis://redis:6379"),
  queueConcurrency: withFile<number>("QUEUE_CONCURRENCY", "1", Number),
  queueRetryMax: withFile<number>("QUEUE_RETRY_MAX", "5", Number),
  queueRetryBaseMs: withFile<number>("QUEUE_RETRY_BASE_MS", "5000", Number),
  smtpHost: withFile<string>("SMTP_HOST", ""),
  smtpPort: withFile<number>("SMTP_PORT", "587", Number),
  smtpUser: withFile<string>("SMTP_USER", ""),
  smtpPass: withFile<string>("SMTP_PASS", ""),
  smtpFrom: withFile<string>("SMTP_FROM", "dequel@localhost"),
  alertEvalIntervalMs: withFile<number>("ALERT_EVAL_INTERVAL_MS", "60000", Number),
  githubClientId: withFile<string>("GITHUB_CLIENT_ID", ""),
  githubClientSecret: withFile<string>("GITHUB_CLIENT_SECRET", ""),
  githubAppName: withFile<string>("GITHUB_APP_NAME", "Dequel"),
  githubWebhookSecret: withFile<string>("GITHUB_WEBHOOK_SECRET", ""),
};
