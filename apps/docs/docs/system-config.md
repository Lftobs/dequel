---
title: System Configuration
category: Platform
description: Environment variables and the dequel.json file for platform settings.
slug: system-config
---

The API reads platform settings from environment variables first, then
from a `dequel.json` file. Environment variables always win.

## Config file location

The API loads the first `dequel.json` it finds:

1. The path in `DEQUEL_CONFIG`
2. `$XDG_CONFIG_HOME/dequel/dequel.json` (usually
   `~/.config/dequel/dequel.json`)
3. `./dequel.json` (next to the process working directory)
4. `./data/dequel.json` (what the installer writes, mode `0600`)

The installer generates `data/dequel.json` with your base domain and a
random `ENV_ENCRYPTION_KEY`.

## Reference

### Identity and domains

| Variable | Default | Source | Description |
|----------|---------|--------|-------------|
| `CADDY_BASE_DOMAIN` | `localhost` | env or file | Base domain for app URLs (`<slug>.<domain>`). Set a real domain with wildcard DNS for auto-SSL. |
| `CADDY_EMAIL` | _(empty)_ | env (Caddy) | Contact for Let's Encrypt notifications. Read by Caddy, not the API. |
| `CONTROL_PLANE_URL` | _(empty)_ | env or file | Public URL of this control plane, used for links and agent registration. |
| `DATABASE_URL` | _(empty)_ | env | PostgreSQL connection string. Empty fails fast with a clear error. |

### Secrets

| Variable | Default | Source | Description |
|----------|---------|--------|-------------|
| `ENV_ENCRYPTION_KEY` | `dev-env-key-change-me` | env | Encrypts env vars, SMTP passwords, and LLM keys at rest. The API **refuses to start in production** with the default — set a unique value. |

### Background engines

| Variable | Default | Description |
|----------|---------|-------------|
| `QUEUE_CONCURRENCY` | `3` | Parallel jobs (builds, provisions, failovers). |
| `QUEUE_RETRY_MAX` | `5` | Retries per failed job. |
| `QUEUE_RETRY_BASE_MS` | `5000` | Base backoff between retries. |
| `ALERT_EVAL_INTERVAL_MS` | `60000` | Alert-rule evaluation cadence. |
| `FAILURE_SWEEP_INTERVAL_MS` | `60000` | Failed-deployment sweep cadence. |
| `FAILOVER_DISABLED` | _(empty)_ | Set to disable automatic failover. |
| `FAILOVER_MIN_INTERVAL_MS` | `600000` | Minimum time between failovers. |

### Observability

| Variable | Default | Description |
|----------|---------|-------------|
| `GRAFANA_URL` | `http://grafana:3000` | Grafana origin for dashboard links. |
| `GRAFANA_USER` / `GRAFANA_PASS` | `admin` / `admin` | Grafana credentials. |

### Agent networking

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_TUNNEL_URL` | _(empty)_ | Tunnel endpoint agents dial back on. |
| `WIREGUARD_SERVER_CONTAINER` | _(empty)_ | WireGuard server container name. |
| `WIREGUARD_SERVER_PUBLIC_KEY` | _(empty)_ | Server public key for agent peers. |
| `WIREGUARD_SERVER_ENDPOINT` | _(empty)_ | Public endpoint agents connect to. |
| `WIREGUARD_SERVER_IP` | `10.200.0.1` | Server address inside the mesh. |
| `WIREGUARD_PEER_CIDR` | `10.200.0.0/24` | Agent address range. |

### Telemetry

Dequel collects anonymous usage telemetry (PostHog) to guide
development. Disable it with either variable:

```bash
DEQUEL_TELEMETRY_DISABLED=1
DO_NOT_TRACK=1
```

### What is configured in the dashboard instead

These have no environment equivalent — set them under
[Settings](/docs/settings):

- GitHub OAuth app (client ID/secret, webhook secret)
- SMTP relay and sender address
- Backup storage (local path or S3)
- LLM provider keys and models
- Ingress server selection

## Full file example

```json
{
  "CADDY_BASE_DOMAIN": "example.com",
  "CONTROL_PLANE_URL": "https://dequel.example.com",
  "QUEUE_CONCURRENCY": 3,
  "FAILOVER_MIN_INTERVAL_MS": 600000
}
```

## Next steps

- Read [Settings](/docs/settings) for dashboard-managed config.
- Read [Servers](/docs/servers) for multi-server networking.
