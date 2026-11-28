---
title: Notification Channels
category: Integrations
description: Route deployment, backup, and alert events to chat apps, email, or webhooks.
slug: notifications
---

**Settings → Event Channels** routes platform events to the tools your
team already watches. Each channel picks a provider, a destination, and
the events it cares about; channels can be disabled without deleting
them.

## Providers

| Provider | Destination |
|---|---|
| Email | recipient address (requires [SMTP](/docs/settings)) |
| Slack | incoming webhook URL |
| Discord | webhook URL |
| Mattermost | incoming webhook URL |
| Generic webhook | any HTTPS URL receiving a JSON POST |
| Telegram | `botToken|chatId` |
| Pushover | `appToken|userKey` |
| ntfy | topic URL, e.g. `https://ntfy.sh/dequl` |
| Gotify | `https://gotify.example.com|appToken` |

## Events

Each channel subscribes to an event matrix:

- **Deployment failed / succeeded** — fired per project deploy with the
  project name and a link to the logs.
- **Backup failed / succeeded** — database and platform backups.
- **Server offline** — a node stopped reporting.
- **Monitoring alert** — CPU, memory, and downtime
  [alert rules](/docs/alerts).

**Send test** pushes a test event to the destination before you depend
on the channel, and reports delivery success or the provider's error.

:::note[Email vs SMTP]
The **SMTP Notifications** tab configures the mail relay itself; a
channel with the `email` provider selects who receives which events.
Alert rules on the email channel need SMTP to deliver.
:::

## Next steps

- Read [Alerts](/docs/alerts) for alert rules and thresholds.
- Read [Audit Logs](/docs/audit-logs) for the action trail.
