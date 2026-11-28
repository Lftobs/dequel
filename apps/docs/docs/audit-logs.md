---
title: Audit Logs
category: Security
description: The trail of privileged actions across the platform.
slug: audit-logs
---

The **Audit Logs** page (sidebar) lists every privileged action on the
platform — who did what to which resource, from where, and when. Use it
for compliance, incident review, or answering "who changed that domain?"

## What is recorded

Entries capture:

- **Action** — e.g. `project.created`, `domain.updated`,
  `deployment.rolled_back`.
- **Actor** — the user id or the API token id (`api_key`), so
  automation-driven changes are attributable.
- **Resource** — type and id of the affected project, domain, server,
  deployment, env var, or setting.
- **Details** — the changed fields and values.
- **IP address** and timestamp.

## Filtering and paging

Filter by action, resource type, or actor type, then page through 50
events at a time. The same filters are available over the API:

```bash
curl -H "Authorization: Bearer dql_<key>" \
  "https://dequl.example.com/api/audit-logs?resourceType=domain&limit=100"
```

`limit` caps at 100 and `offset` pages backward through history.

## Next steps

- Read [Keys & Tokens](/docs/keys) to identify which token made a change.
- Read [Notification Channels](/docs/notifications) to get events pushed.
