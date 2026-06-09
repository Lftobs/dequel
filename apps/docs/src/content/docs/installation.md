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

Open `http://localhost` to access the dashboard.

## Manual Setup with Docker Compose

Clone the repository and run:

```bash
git clone https://github.com/Lftobs/dequel.git
cd dequel
docker compose up -d
```

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
