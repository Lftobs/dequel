const get = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

export const config = {
  port: Number(get('PORT', '3001')),
  databasePath: get('DATABASE_PATH', '/app/data/dequel.db'),
  workspaceRoot: get('WORKSPACE_ROOT', '/app/workspace'),
  caddyRoutesDir: get('CADDY_ROUTES_DIR', '/caddy/routes'),
  caddyIngressBase: get('CADDY_INGRESS_BASE', 'http://localhost'),
  dockerNetwork: get('DOCKER_NETWORK', 'dequel_net'),
  appInternalPort: Number(get('APP_INTERNAL_PORT', '3000')),
  buildkitHost: get('BUILDKIT_HOST', 'tcp://buildkit:1234'),
  envEncryptionKey: get('ENV_ENCRYPTION_KEY', 'dev-env-key-change-me'),
  redisUrl: get('REDIS_URL', 'redis://redis:6379'),
  queueConcurrency: Number(get('QUEUE_CONCURRENCY', '1')),
  queueRetryMax: Number(get('QUEUE_RETRY_MAX', '5')),
  queueRetryBaseMs: Number(get('QUEUE_RETRY_BASE_MS', '5000')),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || '587'),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'dequel@localhost',
  alertEvalIntervalMs: Number(get('ALERT_EVAL_INTERVAL_MS', '60000')),
};
