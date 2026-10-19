---
title: Backups
category: Data
description: Scheduled and on-demand backups with one-click restore.
slug: backups
---

Dequel backs up managed databases on a schedule you set per database,
plus the platform's own internal database. Every snapshot can be
restored to its container from the dashboard, the API, or the CLI.

## Storage

Configure where backups land under **Settings → Backups**:

- **Local** — a path on the control plane (default `/data/backups`).
- **S3** — bucket, endpoint, region, and credentials (works with AWS S3
  and S3-compatible stores like R2).

## Database backups

Each database carries a backup schedule: enable it during provisioning
or later in the database **Settings** tab, with a cron preset (every 6
hours, every 12 hours, daily) and a retention window (1–30 snapshots).
The database **Backups** tab lists snapshots with engine, size, and
date, and offers **Take Backup Now** (while running), **Restore**, and
**Delete**.

Restoring replaces the container's data with the snapshot. Triggering
and restoring are also API calls (`POST /backups/:id/trigger`,
`POST /backups/:id/restore`).

## System backups

The platform database itself is snapshotted on its own cron (hourly to
weekly presets) with its own retention, configured in the same settings
section. **Backup System Database Now** takes an immediate snapshot.

From a shell, the CLI covers the same flows (see [CLI](/docs/cli)):

```bash
dequel backup              # back up the internal database now
dequel backup <db-id>      # back up a managed database now
dequel backup list         # list snapshots
dequel backup restore <id> # restore a snapshot
```

## Next steps

- Read [Managed Databases](/docs/databases) for engine operations.
- Read [CLI](/docs/cli) for shell-driven backup commands.
