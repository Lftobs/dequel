---
title: CLI Reference
category: Platform
description: Manage Dequl from the shell with the dequl command.
slug: cli
---

The installer places the `dequl` command on your `PATH`. It manages
the compose stack, updates, and backups. Configuration lives in
`~/.dequl` (override with `DEQUL_HOME`).

## Lifecycle

| Command | Description |
|---------|-------------|
| `dequl start` | Start all services |
| `dequl stop` | Stop all services |
| `dequl restart` | Restart all services |
| `dequl status` | Show service status |
| `dequl logs [service]` | Follow service logs |
| `dequl uninstall` | Remove everything (prompts first) |
| `dequl --version` | Show version |
| `dequl --help` | Show help |

## Updates

```bash
dequl update              # latest stable (rolling restart)
dequl update --pre        # latest pre-release
dequl update --rc         # latest release candidate
dequl update vX.Y.Z       # a specific version
```

## Backups

```bash
dequl backup              # back up the internal database now
dequl backup <db-id>      # back up a managed database now
dequl backup list         # list snapshots
dequl backup restore <id> # restore a snapshot
```

Snapshots land in the storage configured under **Settings → Backups**
(see [Backups](/docs/backups)).

## API access from scripts

The CLI manages the platform, not your apps. For automation against
your projects, use [API keys](/docs/keys) with `curl`:

```bash
curl -H "Authorization: Bearer dql_<key>" https://dequl.example.com/api/projects
```

## Next steps

- Read [Installation](/docs/installation) for setup.
- Read [Backups](/docs/backups) for the dashboard backup flows.
