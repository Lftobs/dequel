---
title: System Configuration
category: Core Architecture
description: Configure the Dequel platform via environment variables or the dequel.json config file.
slug: system-config
---

Dequel's platform-level settings are configured through environment variables or a `dequel.json` config file. Environment variables take precedence over file values.

## Config File Location

Dequel looks for `dequel.json` in the following order:

1. `DEQUEL_CONFIG` environment variable pointing to an explicit path
2. `~/.config/dequel/dequel.json`
3. `./dequel.json` (next to the binary)
4. `./data/dequel.json`

## Reference

### Security

| Variable | Default | Description |
|----------|---------|-------------|
| `ENV_ENCRYPTION_KEY` | `dev-env-key-change-me` | Key used to encrypt environment variable values and SMTP passwords at rest |

### GitHub Integration

Set these to enable the repo picker in the project creation dialog:

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_CLIENT_ID` | `""` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | `""` | GitHub OAuth App client secret |
| `GITHUB_APP_NAME` | `Dequel` | GitHub App name displayed during OAuth |
| `GITHUB_WEBHOOK_SECRET` | `""` | Secret for GitHub webhook verification |

Config file equivalent:

```json
{
  "githubClientId": "Iv1...",
  "githubClientSecret": "...",
  "githubAppName": "Dequel",
  "githubWebhookSecret": "..."
}
```

On boot, these values seed the `github_integrations` table. You can also update them from the Settings page in the dashboard.

### SMTP

SMTP settings are not read from environment variables or the config file. Configure them from the Settings page in the dashboard, where you can also send a test email to verify the setup. The password is encrypted at rest using `ENV_ENCRYPTION_KEY`.

### Ingress

| Variable | Default | Description |
|----------|---------|-------------|
| `CADDY_BASE_DOMAIN` | `localhost` | Base domain for deployment subdomains. Deployed apps are reachable at `https://<slug>.<domain>`. GitHub webhook URLs are derived from this automatically. Set to a real domain (e.g. `example.com`) and configure wildcard DNS for auto-SSL. |
| `CADDY_EMAIL` | `""` | Email address for Let's Encrypt SSL certificate expiration notifications |

Config file equivalent:

```json
{
  "caddyBaseDomain": "example.com",
  "caddyEmail": "admin@example.com"
}
```

## Full Config File Example

```json
{
  "githubClientId": "Iv1...",
  "githubClientSecret": "...",
  "githubAppName": "MyDequel",
  "githubWebhookSecret": "...",
  "envEncryptionKey": "your-secure-key-here"
}
```

