---
title: Project Configuration
category: Projects
description: Build settings, ports, and resource limits for your project.
slug: configuration
---

Each project carries its build and runtime configuration. You set most of
it in the creation wizard and can change it later on the project's
**Settings** tab (`PATCH /projects/:id`).

## Build settings

**Build strategy** is either `railpack` (automatic single-service build)
or `compose` (multi-container from your repo-root `docker-compose.yml`).
Railpack auto-detects the framework and proposes install, build, and
start commands plus the output directory and port — every field stays
editable for frameworks it guesses wrong.

Useful fields:

- **Root directory** — build a subdirectory of the repo (monorepos).
- **Port** — the port your app listens on inside the container. Railpack
  usually detects this; override it when it does not.
- **Output directory** — for static sites, the folder served after build.
- **Project type** — `web` (long-running server) or `static` (built
  assets served directly).
- **Compose service mapping** — for Compose builds, one row per
  internet-facing service: service name, port, and subdomain. The first
  row is the entry service on the project's main domain; the rest get
  `<subdomain>.<your-app-domain>`.

## Ports and routing

Your app must listen on the configured port on all interfaces
(`0.0.0.0`). A typical Node entrypoint reads it from the environment:

```js
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0");
```

Caddy reverse-proxies the project domain to that port. If the app binds
`localhost` only or a different port, the route returns `502 Bad
Gateway` — check the [route files](/docs/agent-caddy-routes) and the
container's runtime logs.

## Resource limits

On the **Scaling** tab, the resource card sets per-container bounds:

- **CPU limit (cores)** — for example `1.0` for one full core.
- **Memory limit (MB)** — for example `512`. A container that exceeds it
  is killed with an OOM error and restarted.

Autoscaling requires a CPU limit to be set, since the engine scales on
CPU utilization. See [Scaling](/docs/scaling).

## Next steps

- Read [Deployments](/docs/deployments) for the deploy lifecycle.
- Read [Environment Variables](/docs/env-vars) for config injection.
