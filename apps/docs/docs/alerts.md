---
title: Alerts
category: Observability
description: CPU, memory, and downtime alert rules with email, Slack, and webhook channels.
slug: alerts
---

The project's **Alerts** tab defines rules evaluated continuously in
the background. When a rule fires, Dequel notifies the channel you
chose — and failure emails link straight back to the logs.

## Rule types

- **CPU** — fires when average CPU % exceeds your threshold (default
  80%) for the window.
- **Memory** — same for memory % (default 85%).
- **Downtime** — fires immediately when the deployment stops responding.

Create a rule with a metric, threshold (1–100), and channel. Toggle
rules on/off without deleting them.

## Channels

- **Email** — delivered through your [SMTP settings](/docs/settings).
  Failure notifications include a link to the relevant logs.
- **Slack** — posts to an incoming webhook URL (Slack webhook format).
- **Webhook** — generic HTTPS POST to any URL for PagerDuty, Opsgenie,
  or custom receivers.

## Evaluation cadence

Rules evaluate on the platform interval (`ALERT_EVAL_INTERVAL_MS`,
default 60s; see [System Configuration](/docs/system-config)).
Thresholds combine with duration so brief spikes do not page you.

## Next steps

- Read [Settings](/docs/settings) to configure the SMTP relay.
- Read [Observability](/docs/observability) to watch the underlying metrics.
