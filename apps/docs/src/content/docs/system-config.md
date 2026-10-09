---
title: System Configuration
category: Core Architecture
description: How Dequel resolves configuration across fixed system values, environment-only secrets, and editable tunables.
slug: system-config
---

Dequel splits platform configuration into three tiers: fixed system values that
are compiled into the API, environment-only secrets that never come from a
config file, and tunables that you can set through environment variables or a
`dequel.json` file. For tunables, environment variables take precedence over
file values.

## Fixed system values

These values are compiled into the API. Environment variables and `dequel.json`
entries with the same names are ignored.

| Key | Value | Description |
|-----|-------|-------------|
| `port` | `3001` | API listen port. Caddy, container health checks, and Prometheus target this port. |
| `appInternalPort` | `3000` | Port injected into deployed applications as `PORT`, used for reverse-proxy targets. |
| `workspaceRoot` | `/app/workspace` | Build staging directory. |
| `caddyRoutesDir` | `/caddy/routes` | Directory for local Caddy route files. |
| `caddyDataDir` | `/caddy-data/caddy` | Caddy data mount used to detect real TLS certificates. |
| `gatewayCertDir` | `/app/data` | Directory where the gateway stores its self-signed TLS certificate. |
| `dockerNetwork` | `dequel_net` | Docker network for deployments. |
| `buildkitHost` | `tcp://buildkit:1234` | Buildkit daemon address. |
| `redisUrl` | `redis://redis:6379` | Redis queue address. |

Remote servers receive route files through SSH or the agent job queue, which
write to `/etc/caddy/routes` on the remote host.

## Environment-only settings

These settings are read from environment variables only. `dequel.json` never
overrides them.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `""` | PostgreSQL connection string. The install script generates a random database password, and Docker Compose passes the assembled URL to the API and gateway. |
| `ENV_ENCRYPTION_KEY` | `dev-env-key-change-me` | Key that encrypts secrets at rest: environment variables, SSH keys, LLM provider keys, SMTP passwords, S3 credentials, and GitHub session tokens. The install script generates a random key and stores it in `.env`. |

On boot, the API re-encrypts any stored secrets that were written with the
default key so a fresh install key takes effect without manual migration.

## Tunables

Set tunables through environment variables or the config file. In Docker
installs, Compose passes a subset (such as `CADDY_BASE_DOMAIN` and
`GRAFANA_URL`) from `.env`; add others to the api service's `environment` list
in `docker-compose.yml` to make them effective.

| Variable | Default | Description |
|----------|---------|-------------|
| `CADDY_BASE_DOMAIN` | `localhost` | Base domain for deployment subdomains. Deployed apps are reachable at `https://<slug>.<domain>`. Set a real domain and configure wildcard DNS for auto-SSL. |
| `CONTROL_PLANE_URL` | `""` | Public URL of this control plane, used by remote agents. |
| `AGENT_TUNNEL_URL` | `""` | Tunnel endpoint for agent connections. |
| `QUEUE_CONCURRENCY` | `3` | Number of deployment jobs processed in parallel. |
| `QUEUE_RETRY_MAX` | `5` | Maximum retry attempts for failed jobs. |
| `QUEUE_RETRY_BASE_MS` | `5000` | Base delay between job retries. |
| `ALERT_EVAL_INTERVAL_MS` | `60000` | How often alert rules are evaluated. |
| `FAILURE_SWEEP_INTERVAL_MS` | `60000` | How often failed deployments are swept for notifications. |
| `GRAFANA_URL` | `http://grafana:3000` | Grafana base URL shown in the dashboard. |
| `GRAFANA_USER` | `admin` | Grafana sign-in user. |
| `GRAFANA_PASS` | `admin` | Grafana sign-in password. |
| `WIREGUARD_SERVER_CONTAINER` | `""` | Container name of the WireGuard server. |
| `WIREGUARD_SERVER_PUBLIC_KEY` | `""` | Public key of the WireGuard server. |
| `WIREGUARD_SERVER_ENDPOINT` | `""` | WireGuard server endpoint. |
| `WIREGUARD_SERVER_IP` | `10.200.0.1` | WireGuard server IP address. |
| `WIREGUARD_PEER_CIDR` | `10.200.0.0/24` | CIDR range assigned to WireGuard peers. |
| `FAILOVER_DISABLED` | `""` | Set to a non-empty value to disable the failover monitor. |
| `FAILOVER_MIN_INTERVAL_MS` | `600000` | Minimum interval between failover checks for a deployment. |

`CADDY_EMAIL` is a separate Compose-level setting: set it in `.env` to receive
Let's Encrypt certificate expiration notices from the Caddy service.

## Config file location

The API looks for `dequel.json` when resolving tunables, in the following
order:

1. `DEQUEL_CONFIG` environment variable pointing to an explicit path
2. `~/.config/dequel/dequel.json`
3. `./dequel.json` (next to the process working directory)
4. `./data/dequel.json`

File keys use the same names as the environment variables, in upper snake
case, for example `QUEUE_CONCURRENCY`. Numeric values must be JSON numbers,
not strings.

```json
{
  "CADDY_BASE_DOMAIN": "example.com",
  "QUEUE_CONCURRENCY": 5,
  "ALERT_EVAL_INTERVAL_MS": 120000
}
```

## GitHub integration

Configure GitHub OAuth and webhooks from **Settings** in the dashboard. Dequel
stores the client ID, client secret, app name, and webhook secret in the
database. No environment variables or config file keys are read for GitHub.

## SMTP

SMTP settings are not read from environment variables or the config file.
Configure them from the Settings page in the dashboard, where you can also
send a test email to verify the setup. The password is encrypted at rest with
`ENV_ENCRYPTION_KEY`.
