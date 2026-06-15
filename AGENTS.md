# Dequel

Self-hosted deployment platform. Deploy apps from Git, ZIP, or Docker Compose with zero infrastructure setup.

## Tech Stack

- **Runtime**: Bun
- **Backend**: ElysiaJS (`apps/api/`) — TypeScript, port 3001
- **Frontend**: React 18 + Vite + TanStack Router + TanStack Query (`apps/web/`) — port 3000
- **Docs**: Astro 4 + Tailwind CSS (`apps/docs/`) — deployed to Vercel
- **Database**: SQLite (`data/dequel.db`) — raw SQL
- **Queue**: Redis (`ioredis`) for async job queue
- **Container build**: Railpack CLI + BuildKit daemon
- **Container runtime**: Docker Engine API (mounted Docker socket)
- **Ingress**: Caddy (dynamic route files + auto SSL)

## Architecture

```
Caddy ──▶ API ──▶ Buildkit
  │          │
  ▼          ▼
 Web      SQLite    Redis

Observability: cAdvisor → Prometheus → Grafana / Loki
```

Services run in Docker Compose: Caddy, API, Web, Buildkit, Redis, cAdvisor, Prometheus, Loki, Promtail, Grafana.

## Directory Structure

```
├── apps/
│   ├── api/          # Backend orchestrator (Bun + ElysiaJS)
│   │   ├── src/
│   │   │   ├── api/          # Route handlers
│   │   │   ├── db/           # Database migrations + queries
│   │   │   ├── orchestrator/ # Deployment orchestration logic
│   │   │   ├── scaling/      # Auto-scaling engine
│   │   │   ├── monitoring/   # Alert evaluation, Prometheus metrics
│   │   │   ├── servers/      # Server management
│   │   │   └── git/          # Git operations
│   │   └── Dockerfile
│   ├── web/          # React dashboard (Vite + TanStack)
│   │   ├── src/
│   │   │   ├── routes/       # TanStack Router route definitions
│   │   │   ├── components/   # Shared UI components
│   │   │   ├── api/          # API client
│   │   │   └── hooks/        # Custom hooks
│   │   └── Dockerfile
│   └── docs/         # Documentation site (Astro)
│       ├── src/
│       │   ├── content/docs/ # Markdown doc pages (content collection)
│       │   ├── layouts/      # Layout component with sidebar
│       │   ├── components/   # Landing page components
│       │   └── styles/       # Global CSS
│       └── vercel.json
├── infra/
│   ├── caddy/        # Caddyfile + dynamic route files
│   └── monitoring/   # Prometheus, Loki, Grafana configs
├── scripts/
│   ├── install.sh    # One-command install script
│   └── dequel        # CLI for managing the platform
├── data/             # SQLite database (persisted)
├── workspace/        # Build staging area
├── docker-compose.yml
├── VERSION           # Single source of truth for version
├── CHANGELOG.md      # Release history
└── AGENTS.md         # This file
```

## Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/index.ts` | API entry point — bootstraps DB, queue, scaling engine, etc. |
| `apps/api/src/db/schema.ts` | Drizzle ORM schema definitions (all tables) |
| `apps/api/src/db/drizzle.ts` | Drizzle client wrapper (wraps `bun:sqlite`) |
| `apps/api/src/db/migrations/` | Drizzle Kit migration files (`drizzle-kit generate` outputs here) |
| `apps/api/drizzle.config.ts` | Drizzle Kit configuration |
| `apps/web/src/main.tsx` | Frontend entry point |
| `apps/web/src/routes/index.tsx` | TanStack Router tree definition |
| `apps/web/src/routes/Dashboard.tsx` | Main dashboard page |
| `apps/web/src/components/Layout.tsx` | Shared app layout (sidebar, header) |
| `apps/docs/src/layouts/Layout.astro` | Docs layout with sidebar (auto-generated from content collection) |
| `apps/docs/src/pages/docs/[...slug].astro` | Catch-all route rendering content collection entries |
| `apps/docs/src/content.config.ts` | Astro content collection schema |
| `scripts/install.sh` | Install script — downloads configs, pulls images, installs CLI |
| `scripts/dequel` | CLI tool — `start`, `stop`, `status`, `logs`, `update`, `uninstall` |
| `.github/workflows/release.yml` | On `v*` tag: build Docker images → ghcr.io, create GitHub Release |
| `.github/workflows/deploy-docs.yml` | On push to `main`/`dev` (docs changes): deploy to Vercel |

## Commands

```bash
# Development (API)
bun apps/api/src/index.ts

# Development (Web)
bun apps/web/src/main.tsx

# Inside apps/web/
bun run build        # Vite build
bun run dev          # Vite dev server

# Inside apps/api/
bun test             # Run tests

# Inside apps/docs/
bun run dev          # Astro dev server
bun run build        # Astro build

# Docker
docker compose up -d               # Start full stack
docker compose up -d --build       # Rebuild and start

# Install / Manage
curl -fsSL https://raw.githubusercontent.com/Lftobs/dequel/main/scripts/install.sh | sh
scripts/dequel start               # Start platform
scripts/dequel uninstall           # Remove everything (prompts)

# Drizzle migrations (run from apps/api/)
bunx drizzle-kit generate          # Generate migration from schema changes
bunx drizzle-kit push              # Push schema directly (dev only)

# Version sync
bun run sync-versions              # Syncs VERSION → sub-package.json files
```

## Code Conventions

- No comments in source code unless absolutely necessary
- no file should be above 500 lines of code...if it really is, refactor and split into smaller files properly managed in a folder not scattered across the codebase (proper feature grouping).
- Named exports over default exports
- No emojis in code or UI unless explicitly requested
- Functional components with hooks (React)
- Tailwind CSS for styling (both web and docs)
- Astro content collections for docs

## Adding a Doc Page

1. Create `.md` file in `apps/docs/src/content/docs/` with frontmatter:
   ```yaml
   ---
   title: Page Title
   category: Category Name
   description: Short description.
   slug: page-slug
   ---
   ```
2. If it's a new category, add it to `categoryOrder` array in `apps/docs/src/layouts/Layout.astro`.
3. The sidebar updates automatically from the content collection.

## Release Process

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

CI builds Docker images → `ghcr.io/lftobs/dequel/{api,web}:X.Y.Z` and creates a GitHub Release with `docker-compose.yml`, `scripts/install.sh`, `scripts/dequel` as assets.

## Vercel Deploy (Docs)

`.github/workflows/deploy-docs.yml` deploys docs on push to `main` or `dev`:

| Branch | Domain |
|--------|--------|
| `main` | `dequel.intrep.xyz` |
| `dev` | `dev.dequel.intrep.xyz` |

Requires secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

## Environment Variables (API)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API listen port |
| `DATABASE_PATH` | `./data/dequel.db` | SQLite database |
| `WORKSPACE_ROOT` | `./workspace` | Build staging |
| `CADDY_ROUTES_DIR` | `./infra/caddy/routes` | Caddy route output |
| `CADDY_BASE_DOMAIN` | `localhost` | Base domain for deployment subdomains. Set to a real domain (e.g. `example.com`) for Let's Encrypt auto-SSL. |
| `CADDY_EMAIL` | _(empty)_ | Email for Let's Encrypt SSL certificate notifications |
| `DOCKER_NETWORK` | `dequel_net` | Docker network for deployments |
| `BUILDKIT_HOST` | `tcp://buildkit:1234` | Buildkit daemon |
| `RAILPACK_BUILD_TIMEOUT_MS` | `1200000` | Build timeout |

## Boundaries

- Never commit secrets or `.env` files
- Drizzle ORM for migrations; raw SQL is still used in `repo.ts` for queries (may be migrated incrementally)
- Database: SQLite with `bun:sqlite` (future: Drizzle ORM + PostgreSQL)
- `.gitignore` ignores `infra/caddy/routes/`, NOT `apps/web/src/routes/`
- Always run `bun test` in `apps/api/` before committing API changes
- Docs landing page (`index.astro`) is standalone — no shared layout
- `set -euo pipefail` in all bash scripts; use functions, not flat code
