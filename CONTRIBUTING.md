# Contributing to Dequel

Thank you for your interest in contributing! Here's how to get started.

## Getting Started

1. Fork and clone the repo
2. Install dependencies: `bun install` (from repo root — needed for tests, version syncing, and local tooling)
3. Read [`AGENTS.md`](./AGENTS.md) for the full architecture and conventions

## Reporting Bugs

Open a [Bug Report](https://github.com/Lftobs/dequel/issues/new?template=bug_report.md). Include:

- Steps to reproduce
- Expected vs actual behavior
- Dequel version (`VERSION` file or `scripts/dequel status`)
- Environment details (OS, Docker version, browser if relevant)

## Suggesting Features

Open a [Feature Request](https://github.com/Lftobs/dequel/issues/new?template=feature_request.md). Describe:

- The problem you're solving
- Your proposed solution
- Any alternatives considered
- Whether you'd like to implement it yourself

## Development

### Running Locally

Run the full stack with Docker Compose:

```bash
docker compose up -d --build
```

This starts all services (API, Web, Caddy, BuildKit, Redis, Prometheus, Loki, Grafana). The dashboard is at `https://localhost`, API at `https://localhost/api`, Grafana at `https://localhost/grafana` (admin/admin).

### Code Conventions

- **No comments** in source code unless absolutely necessary
- **Named exports** over default exports
- **Functional components + hooks** in React
- **Tailwind CSS** for styling (web and docs)
- Max ~500 lines per file — split into feature-grouped directories
- `set -euo pipefail` in all bash scripts

### Database Migrations

Run from `apps/api/`:

```bash
cd apps/api
bunx drizzle-kit generate
bunx drizzle-kit push
```

### Testing

Run from `apps/api/`:

```bash
cd apps/api && bun test
```

Always run tests before committing API changes.

### Versioning

```bash
./bump.sh v0.2.0
```

This updates `VERSION`, all `package.json` files, and optionally adds a changelog entry.

## Pull Requests

1. Create a PR from your fork using the [PR template](./.github/PULL_REQUEST_TEMPLATE.md)
2. Ensure all tests pass (`cd apps/api && bun test`)
3. Keep changes focused — one feature/fix per PR
4. Update documentation if your change affects user-facing behavior
5. If changing API behavior, update the docs site content

### PR Checklist

- [ ] Tests pass (`cd apps/api && bun test`)
- [ ] No new warnings or lint errors
- [ ] Documentation updated (if applicable)
- [ ] Version synced (`bun run sync-versions`) if `VERSION` changed
- [ ] Follows code conventions (no comments, named exports, etc.)

## Release Process

Maintainers cut releases by tagging:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

CI builds Docker images to `ghcr.io/lftobs/dequel/{api,web}:X.Y.Z`, deploys docs to Vercel, and creates a GitHub Release.

## Questions?

Open a [Discussion](https://github.com/Lftobs/dequel/discussions) for questions and community support.
