---
title: Agent Caddy Routes
category: Deployment
description: How the agent container manages Caddy route files for deployed applications.
slug: agent-caddy-routes
---

The `CADDY_ROUTES_DIR` environment variable controls where the API writes Caddy route files. On agent servers, the default is `/etc/caddy/routes`. Each deployed application gets its own `.caddy` file in this directory.

## Route Directory

The route directory path is resolved from the `CADDY_ROUTES_DIR` environment variable. In local mode (API and Caddy on the same host), this defaults to `/caddy/routes`. On remote agent servers, the agent writes to `/etc/caddy/routes`.

The directory must exist and be writable by the process managing Caddy. The API creates it automatically on startup.

## Caddyfile Import Directive

The main Caddyfile at `/etc/caddy/Caddyfile` includes all route files via a glob import:

```text
import /etc/caddy/routes/*.caddy
```

Each `.caddy` file is a standalone Caddy site block. Caddy reads all matching files at startup and merges them into its routing table.

## Route File Format

A route file contains a single Caddy site block. The filename matches the project slug:

```text
my-app.caddy
```

The file content defines the hostname, logging, and reverse proxy target:

```caddyfile
my-app.localhost:80 {
  log {
    output stdout
    format json
  }
  reverse_proxy my-app-abc12345:17476 {
    header_up Host {upstream_hostport}
  }
}
```

- **Hostname:** `<project-slug>.<base-domain>` (e.g., `my-app.localhost:80` or `my-app.example.com`)
- **Container name:** `<project-slug>-<deployment-id-prefix>` (e.g., `my-app-abc12345`)
- **Port:** The application's internal port (default `17476`, or `PORT` env var value)

For custom domains, multiple hostnames are comma-separated on the first line:

```caddyfile
my-app.localhost:80, blog.example.com:80 {
  log {
    output stdout
    format json
  }
  reverse_proxy my-app-abc12345:17476 {
    header_up Host {upstream_hostport}
  }
}
```

## Route Lifecycle

### Deploy

When a deployment completes successfully:

1. The API builds a Caddy snippet using `buildCaddySnippet()` from `apps/api/src/utils/domain-verifier.ts`.
2. The snippet is written to `<CADDY_ROUTES_DIR>/<project-slug>.caddy`.
3. Caddy is reloaded via `caddy reload --config /etc/caddy/Caddyfile`.
4. A route record is persisted to the database with status `active`.

For remote agent servers, the control plane sends a `reload_routes` job to the agent. The agent writes the file and reloads Caddy on the remote host.

### Rollback

Rollback creates a new deployment with the old image tag. The existing route file is overwritten with the new container name, and Caddy is reloaded.

### Delete

When a deployment is destroyed:

1. A `reload_routes` job is queued with `action: "remove"`.
2. The agent deletes the `.caddy` file from the routes directory.
3. Caddy is reloaded, removing the route from the routing table.

On the control plane side, `removeIngressRouteFile()` in `apps/api/src/utils/ingress.ts` handles cleanup for both local and remote modes.

### Custom Domain Addition

When a verified custom domain is added to a project, `addToCaddyRoute()` in `apps/api/src/utils/domain-verifier.ts` modifies the existing route file to include the new hostname. It reads the current content, appends the domain to the first line, and reloads Caddy.

## Reload vs Restart

Dequel uses `caddy reload`, not `caddy restart`:

- **Reload** (`caddy reload --config /etc/caddy/Caddyfile`) applies configuration changes without dropping active connections. Existing requests continue to be served.
- **Restart** would terminate all connections and re-initialize Caddy, causing downtime.

Reload is triggered after every route file change (deploy, rollback, delete, custom domain update).

## Troubleshooting

### Route files not appearing

1. Check that `CADDY_ROUTES_DIR` is set correctly and the directory exists.
2. Verify the API process has write permissions to the directory.
3. For agent servers, ensure the agent is running and reachable (check heartbeat status in the dashboard).

### Caddy not picking up changes

1. Confirm the route file exists in the routes directory: `ls /etc/caddy/routes/`.
2. Manually reload Caddy: `docker exec dequel-caddy caddy reload --config /etc/caddy/Caddyfile`.
3. Check Caddy logs for configuration errors: `docker logs dequel-caddy`.

### 502 Bad Gateway

The route file points to a container name that does not exist or is not on the same Docker network. Verify the container is running and connected to `dequel_net`:

```bash
docker ps --filter name=<project-slug>
docker network inspect dequel_net
```

### Custom domain not routing

Ensure the domain is verified in the Dequel dashboard and the DNS record points to the correct IP. Check that the hostname appears in the route file's first line.
