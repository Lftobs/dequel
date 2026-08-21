---
title: Control Plane Setup
category: Getting Started
description: Run the Dequel control panel on your own machine and connect remote servers.
slug: control-plane
---

The control plane (dashboard + API) can run on any machine with Docker — including your personal computer. All builds, containers, and Caddy routing happen on the **servers** you connect; the control plane only orchestrates them over SSH or the P2P WireGuard agent.

## Install the control plane

The install script sets up only the control-plane services by default (`api`, `web`, `caddy`, `redis`):

```bash
curl -fsSL https://github.com/Lftobs/dequel/releases/latest/download/install.sh | bash
dequel start
```

Open `http://localhost` to access the dashboard.

### Profiles

The Compose file groups optional services behind profiles:

| Profile | Services | When to enable |
|---------|----------|----------------|
| (default) | api, web, caddy, redis | Control plane only |
| `build` | buildkit | Local builds on the control plane |
| `monitoring` | cAdvisor, Prometheus, Loki, Promtail, Grafana | Server-side monitoring stack |

`DEQUEL_PROFILE` is written to `~/.dequel/.env` during install. To run the full stack (buildkit + monitoring):

```bash
# in ~/.dequel/.env
DEQUEL_PROFILE=full
dequel restart
```

## Connecting servers

### SSH mode (recommended)

1. In **Settings → Servers**, add your server with its IP/hostname, SSH port, and SSH user (defaults to `root`).
2. The server only needs SSH access from the control plane — Docker, Caddy, and Railpack are installed for you.
3. Click **Prepare** on the server row. Dequel streams live progress as it:
   - Connects over SSH and detects the OS
   - Installs Docker if missing
   - Installs Caddy and configures `/etc/caddy/routes/`
   - Installs the Railpack CLI
4. When the stream reports success, the server is ready to deploy to.

Prepare is idempotent — re-running it skips anything already installed.

### Agent mode (firewalled nodes)

For servers without open SSH ports, add the server as **Agent**, then click **Prepare**. Dequel generates a registration token and shows a `docker run` command — run it on the target server. The agent registers back over the control plane and establishes a direct WireGuard tunnel. The prepare stream waits until the agent reports connected.

## Shared base domain

All servers share a single base domain. Set it once on the control plane:

```
CADDY_BASE_DOMAIN=example.com
```

Every project defaults to `<name>.<base-domain>` (e.g. `api.example.com`) **regardless of which server it is deployed to** — Dequel generates identical route hostnames everywhere.

DNS setup: point `*.example.com` at your servers. With multiple servers behind one wildcard, either:

- Point the wildcard record at a single ingress server, or
- Add per-deployment A records (`api.example.com → server-ip`) for finer control

Projects with a custom domain configured bypass the base domain entirely.