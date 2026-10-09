---
title: Managed Databases
category: Cluster Storage & Data
description: Provision PostgreSQL and MySQL engine instances securely connected to your application's private network.
slug: databases
---

Dequel provides fully-managed SQL database engines. Databases run as independent services on dedicated cluster nodes, complete with internal DNS endpoints, health tracking, and isolated storage mounts.

## Supported Engines & Versions

Configure database versions through the provisioning dialog:

- **PostgreSQL:** Supports `16-alpine` (Recommended), `15-alpine`, `14-alpine`, and `13-alpine`.
- **MySQL:** Supports `8.0` (Recommended), `8.4`, and `5.7`.

## Capacity Planning

Specify the boundary compute resource allocation during database provisioning:

- **CPU:** Fraction of host processor power allocated (e.g. `0.5 cores`).
- **Memory:** Boundary RAM buffer allocated to database engines (e.g. `512MB`).

## Connection Secrets

Once provisioned, Dequel generates a private DNS connection string:

<div class="rounded-xl border border-border bg-[#070709] p-4 font-mono text-[11px] text-zinc-400 break-all select-none">
  postgresql://postgres:random-password@db-my-web-app.dequel.local:5432/postgres
</div>

To inject this secret into your container runtime, navigate to **Environment Variables** and add:

<div class="rounded-xl border border-border bg-[#070709] p-4 font-mono text-[11px] text-zinc-300">
  DATABASE_URL=postgresql://postgres:random-password@db-my-web-app.dequel.local:5432/postgres
</div>

## Remote Access via the Gateway

When **Public Access** is enabled, Dequel issues an external connection string that travels through the shared HTTPS port (443). The gateway reads the hostname from the TLS handshake and forwards the raw bytes to the database, so only ports 22, 80, and 443 ever need to be open — no per-database firewall rules, no random high ports.

### How exposing works for PostgreSQL, MongoDB, and Redis

PostgreSQL, MongoDB, and Redis all expose through the gateway the same way. To expose one of them:

1. Open the database in the dashboard and turn on **Public Access**.
2. Dequel writes a gateway route for `db-<id>.<your-domain>` and Caddy automatically provisions a Let's Encrypt certificate for that hostname. This takes seconds and renews on its own.
3. Connect from any machine with the external string Dequel hands out. Your client opens TLS to port 443 and announces the hostname; the gateway checks the database status, the Public Access toggle, and the optional IP allowlist, then forwards raw bytes to the database — including databases that run on a remote server in your cluster.

Setup requirements:

- Set `CADDY_BASE_DOMAIN` to your domain (for example `dequel.example.com`).
- Point a wildcard DNS record (`*.dequel.example.com`) at the server's IP address.
- Connect with TLS. The gateway routes by the hostname announced in the TLS handshake, so plaintext clients cannot be routed through it.

Exposed databases receive strings that require TLS:

<div class="rounded-xl border border-border bg-[#070709] p-4 font-mono text-[11px] text-zinc-400 break-all select-none">
  postgresql://user:password@db-1a2b3c4d.dequel.example.com:443/dbname?sslmode=require
</div>

<div class="rounded-xl border border-border bg-[#070709] p-4 font-mono text-[11px] text-zinc-400 break-all select-none">
  mongodb://user:password@db-1a2b3c4d.dequel.example.com:443/dbname?authSource=admin&tls=true
</div>

<div class="rounded-xl border border-border bg-[#070709] p-4 font-mono text-[11px] text-zinc-400 break-all select-none">
  rediss://:password@db-1a2b3c4d.dequel.example.com:443
</div>

If **Public Access** is disabled, no external endpoint is issued — the database only receives its internal cluster string.

### MySQL — direct port instead

MySQL is the one exception. Its wire protocol sends a server greeting before the client says anything, so there is no client-announced hostname for the gateway to route on. Exposed MySQL databases therefore keep the direct port path: Dequel publishes a random port on the database's own server, and the credentials panel shows the endpoint (`<server-ip>:<random-port>`) along with a warning while the port is still blocked. Open that port in your server's firewall or security group, or use the dashboard SQL console instead.

Notes:

- The gateway terminates TLS with a Let's Encrypt certificate for the database hostname — Caddy issues it within seconds of enabling Public Access and renews it automatically — so the strings above verify out of the box. In the gaps (right after enabling Public Access, or on a `localhost` setup with no base domain) the gateway falls back to a self-signed certificate: MongoDB strings carry `tlsAllowInvalidCertificates=true` (verification off) until a real certificate exists; for PostgreSQL append `&uselibpqcompat=true` (Node only; psql rejects that flag) or set `ssl: { rejectUnauthorized: false }` in client code; Redis clients verify certificates by default, so set `rejectUnauthorized: false` in your client configuration while the fallback is in effect.
- PostgreSQL clients work either way: classic clients send a plaintext `SSLRequest` first (the gateway answers it locally), and direct-TLS clients (`sslmode=direct`) announce the hostname immediately.
- Every new connection is checked against the database status, the Public Access toggle, and the optional IP allowlist before any bytes are forwarded.

