---
title: CLI Reference
category: Platform
description: Manage Dequel from the shell with the dequel command.
slug: cli
---

The installer places the `dequel` command on your `PATH`. It manages
the compose stack, updates, and backups. Configuration lives in
`~/.dequel` (override with `DEQUEL_HOME`).

## Lifecycle

| Command | Description |
|---------|-------------|
| `dequel start` | Start all services |
| `dequel stop` | Stop all services |
| `dequel restart` | Restart all services |
| `dequel status` | Show service status |
| `dequel logs [service]` | Follow service logs |
| `dequel uninstall` | Remove everything (prompts first) |
| `dequel --version` | Show version |
| `dequel --help` | Show help |

## Updates

```bash
dequel update              # latest stable (rolling restart)
dequel update --pre        # latest pre-release
dequel update --rc         # latest release candidate
dequel update vX.Y.Z       # a specific version
```

## Backups

```bash
dequel backup              # back up the internal database now
dequel backup <db-id>      # back up a managed database now
dequel backup list         # list snapshots
dequel backup restore <id> # restore a snapshot
```

Snapshots land in the storage configured under **Settings → Backups**
(see [Backups](/docs/backups)).

## API access from scripts

The CLI manages the platform, not your apps. For automation against
your projects, use [API keys](/docs/keys) with `curl`:

```bash
curl -H "Authorization: Bearer dql_<key>" https://dequel.example.com/api/projects
```

## Next steps

- Read [Installation](/docs/installation) for setup.
- Read [Backups](/docs/backups) for the dashboard backup flows.
