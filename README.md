# Dequel

Dequel is a self-hosted deployment platform. It lets you deploy applications
from Git repositories, file uploads, or Docker Compose files with zero
infrastructure setup. Built with [Railpack](https://railway.app/railpack) for
automatic build detection and container orchestration on your own servers.

## Features

- **Source deploy**: Git push, ZIP upload, or Docker Compose
- **Auto build**: Railpack detects the stack (Node, Python, Go, Rust, etc.) and
  builds without a Dockerfile
- **Managed databases**: PostgreSQL and MySQL containers provisioned per project
- **Custom domains**: Attach domains with automatic SSL via Caddy/Let's Encrypt
- **Auto-scaling**: CPU-threshold based horizontal scaling with configurable
  cooldown
- **Environment variables**: Per-project env var management with redeploy hooks
- **Persistent volumes**: Docker volumes attached to deployments
- **Observability**: Prometheus, Loki, Grafana, cAdvisor stack built in
- **Alerts**: CPU/memory threshold alerts via email or webhook
- **Multi-server**: (MVP2) Distributed nodes via Docker Engine API
- **API keys**: Programmatic access to the control plane

## Architecture

```
┌──────────┐   ┌──────────┐   ┌───────────┐
│  Caddy   │──▶│   API    │──▶│ Buildkit  │
│ (ingress)│   │(ElysiaJS)│   │(Railpack) │
└────┬─────┘   └────┬─────┘   └───────────┘
     │               │
     ▼               ▼
┌──────────┐   ┌──────────┐   ┌───────────┐
│   Web    │   │  SQLite  │   │   Redis   │
│(TanStack)│   │ / PG     │   │ (queue)   │
└──────────┘   └──────────┘   └───────────┘

Observability:
┌──────────┬──────────┬──────────┬──────────┐
│cAdvisor  │Prometheus│  Loki    │ Grafana  │
└──────────┴──────────┴──────────┴──────────┘
```

Services run in Docker Compose:

1. **Caddy** (port 80): Reverse proxy routing `/api/*` to the API, `/*` to the
   web dashboard, and `<deploymentId>.localhost` to user containers.
2. **API** (Bun + ElysiaJS): Orchestration engine handling deploys, builds,
   databases, scaling, and DNS validation.
3. **Web** (React + Vite + TanStack Router/Query): Dashboard for managing
   projects, deployments, and settings.
4. **Buildkit**: Daemon backing Railpack container builds.
5. **Redis**: Job queue for async operations.
6. **cAdvisor / Prometheus / Loki / Grafana**: Monitoring and observability.

## Prerequisites

- Docker and Docker Compose installed on your system
- Optional: Bun installed globally for local development

## Quick Start

```bash
docker compose up -d --build
```

Open `http://localhost` to see the dashboard.

## Development

Run services locally (without Docker) for faster iteration:

```bash
# Terminal 1 - API
export DATABASE_PATH=./data/dequel.db \
       WORKSPACE_ROOT=./workspace \
       CADDY_ROUTES_DIR=./infra/caddy/routes \
       DOCKER_NETWORK=dequel_net \
       APP_INTERNAL_PORT=3000
bun apps/api/src/index.ts

# Terminal 2 - Web
bun apps/web/src/main.tsx
```

## Directory Structure

- `apps/api/` -- Backend orchestrator (ElysiaJS/Bun). Routes, workers,
  database provisioning, scaling engine, server manager.
- `apps/web/` -- Frontend dashboard (React/Vite/TanStack).
- `infra/caddy/` -- Caddyfile config and deployment-specific route files.
- `infra/monitoring/` -- Prometheus, Loki, Promtail, Grafana configs.
- `data/` -- SQLite database, persisted across restarts.
- `workspace/` -- Staging area for source files during builds.

## How Deployments Work

1. **Source preparation**: API fetches code (Git clone, ZIP extract, or Compose
   reference) into `./workspace/<deploymentId>`.
2. **Build**: Railpack CLI auto-detects the stack and builds a Docker image
   (`dequel-<deploymentId>:latest`) via Buildkit.
3. **Runtime**: A container (`deploy-<deploymentId>`) starts on the
   `dequel_net` network. Environment variables and volumes are injected.
4. **Ingress**: Caddy gets a route file mapping
   `<deploymentId>.localhost` to the container's internal port. Caddy is
   reloaded dynamically.
5. **Health check**: The system verifies the container stays running after a
   stabilization period. If it crashes immediately, the error logs surface
   in the UI.

## Configuration

Key environment variables for the API service:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API listen port |
| `DATABASE_PATH` | `./data/dequel.db` | SQLite database location |
| `WORKSPACE_ROOT` | `./workspace` | Build staging directory |
| `CADDY_ROUTES_DIR` | `./infra/caddy/routes` | Caddy route output |
| `DOCKER_NETWORK` | `dequel_net` | Docker network for deployments |
| `BUILDKIT_HOST` | `tcp://buildkit:1234` | Buildkit daemon address |
| `RAILPACK_BUILD_TIMEOUT_MS` | `1200000` | Build timeout |

## Deployment Ingress

Deployed applications get a subdomain under `localhost`:
```
http://<deploymentId>.localhost
```

For production, set `CADDY_BASE_DOMAIN` and configure DNS. Caddy
auto-provisions SSL via Let's Encrypt.

## Design Decisions

- **SQLite for dev, PostgreSQL for prod**: Keeps development zero-config. The
  repo layer is structured to swap to Drizzle ORM + PostgreSQL.
- **Caddy first, Traefik optional**: Caddy provides automatic SSL and simple
  config. A Traefik config is available as a drop-in for multi-server setups.
- **CPU-based auto-scaling**: Scales on CPU threshold with configurable
  cooldown. Updates Caddy load balancer routes dynamically.
- **Boot-time reconciliation**: On startup, the API cross-references the
  database against running containers and restarts missing deployments.
