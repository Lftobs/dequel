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

