---
title: Installation
category: Getting Started
description: Install Dequel on your own infrastructure.
slug: installation
---

## Prerequisites

- **Docker** installed on your system
- **Docker Compose v2** (`docker compose` command)

## Install Script

The quickest way to get Dequel running:

```bash
curl -fsSL https://raw.githubusercontent.com/Lftobs/dequel/main/scripts/install.sh | sh
```

This will:

1. Check that Docker and Docker Compose are installed
2. Create a config directory at `~/.dequel`
3. Download `docker-compose.yml` and monitoring configs
4. Pull pre-built Docker images from GitHub Container Registry
5. Install the `dequel` CLI to `/usr/local/bin`

After installation, start the platform:

```bash
dequel start
```

Open `http://localhost` to access the dashboard (or the configured `CADDY_BASE_DOMAIN` in production).

## Manual Setup (no install script)

If the installer fails, set up the platform manually with just Docker Compose and the config files:

```bash
# Create the installation directory
mkdir -p ~/.dequel/data ~/.dequel/workspace \
  ~/.dequel/infra/caddy/routes \
  ~/.dequel/infra/monitoring/grafana/datasources

# Download config files
curl -fsSL https://raw.githubusercontent.com/Lftobs/dequel/main/docker-compose.yml \
  -o ~/.dequel/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/Lftobs/dequel/main/infra/caddy/Caddyfile \
  -o ~/.dequel/infra/caddy/Caddyfile
curl -fsSL https://raw.githubusercontent.com/Lftobs/dequel/main/infra/monitoring/prometheus.yml \
  -o ~/.dequel/infra/monitoring/prometheus.yml
curl -fsSL https://raw.githubusercontent.com/Lftobs/dequel/main/infra/monitoring/loki-config.yml \
  -o ~/.dequel/infra/monitoring/loki-config.yml
curl -fsSL https://raw.githubusercontent.com/Lftobs/dequel/main/infra/monitoring/promtail-config.yml \
  -o ~/.dequel/infra/monitoring/promtail-config.yml
curl -fsSL https://raw.githubusercontent.com/Lftobs/dequel/main/infra/monitoring/grafana/datasources/loki.yml \
  -o ~/.dequel/infra/monitoring/grafana/datasources/loki.yml
curl -fsSL https://raw.githubusercontent.com/Lftobs/dequel/main/infra/monitoring/grafana/datasources/prometheus.yml \
  -o ~/.dequel/infra/monitoring/grafana/datasources/prometheus.yml

# Start all services
docker compose -f ~/.dequel/docker-compose.yml up -d
```

The compose file uses pre-built images from GitHub Container Registry, so no source code checkout is needed. Access the dashboard at `http://localhost` (or your configured `CADDY_BASE_DOMAIN`).

## Manual Setup with Docker Compose (with source)

Clone the repository and build from source:

```bash
git clone https://github.com/Lftobs/dequel.git
cd dequel
docker compose up -d --build
```

## Production Setup

To make Dequel publicly accessible with auto-SSL:

1. Set `CADDY_BASE_DOMAIN` and `CADDY_EMAIL` in `~/.dequel/.env`:
   ```
   CADDY_BASE_DOMAIN=example.com
   CADDY_EMAIL=admin@example.com
   ```
2. Configure a wildcard DNS `*.example.com` pointing to your server's IP.
3. Ensure ports `80` and `443` are open in your firewall.
4. Restart Dequel: `dequel restart`

Deployed apps will be reachable at `https://<slug>.example.com` with auto-provisioned Let's Encrypt certificates. The dashboard is available at both `http://example.com` and `https://example.com`.

## The `dequel` CLI

The `dequel` command manages the platform lifecycle:

| Command | Description |
|---------|-------------|
| `dequel start` | Start all Dequel services |
| `dequel stop` | Stop all services |
| `dequel status` | Show service status |
| `dequel logs` | Follow service logs |
| `dequel update` | Pull latest images and restart |
| `dequel restart` | Restart all services |
| `dequel --help` | Show all commands |

## Configuration Directory

Dequel stores its configuration in `~/.dequel` (or `$DEQUEL_HOME` if set):

```
~/.dequel/
├── docker-compose.yml
├── .env                    # Optional environment overrides
├── data/                   # SQLite database
├── workspace/              # Build staging area
└── infra/
    ├── caddy/
    │   ├── Caddyfile
    │   └── routes/
    └── monitoring/
        ├── prometheus.yml
        ├── loki-config.yml
        └── grafana/
```

## Building from Source

For local development, run the API and web dashboard directly:

```bash
# Terminal 1 — API
export DATABASE_PATH=./data/dequel.db \
       WORKSPACE_ROOT=./workspace \
       CADDY_ROUTES_DIR=./infra/caddy/routes \
       CADDY_BASE_DOMAIN=localhost \
       DOCKER_NETWORK=dequel_net \
       APP_INTERNAL_PORT=3000
bun apps/api/src/index.ts

# Terminal 2 — Web
bun apps/web/src/main.tsx
```

## Updating

```bash
dequel update
```

This pulls the latest images from GitHub Container Registry and recreates the services.
