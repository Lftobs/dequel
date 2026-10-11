---
title: Platform Settings
category: Integrations
description: SMTP, ingress, backup storage, GitHub, servers, and AI keys.
slug: settings
---

**Settings** (sidebar) is where the platform itself is configured. A
banner counts registered nodes and flags integrations that still need
attention.

## Servers

Connect machines over SSH or WireGuard agents, prepare them with Docker
/ Caddy / BuildKit, and pick deployment targets. Documented in full
under [Servers](/docs/servers).

## Backups

Local-path or S3 storage plus the internal database schedule. See
[Backups](/docs/backups).

## GitHub

OAuth app credentials, connect/disconnect, and the callback URL. See
[GitHub](/docs/github).

## SMTP

The relay for alert emails and failure notifications: host, port, user,
password (encrypted at rest), and sender address, with presets for
Resend, SendGrid, Postmark, Mailgun, and AWS SES. **Send Test Email**
verifies the setup before you depend on it.

Without SMTP, email-channel [alert rules](/docs/alerts) cannot deliver
— Slack and webhook channels work independently.

## AI

Provider keys for [AI Diagnosis](/docs/ai-diagnosis): OpenAI, Anthropic,
Gemini, Groq, self-hosted Ollama, or any custom OpenAI-compatible
endpoint (base URL). Keys are AES-256-GCM encrypted and never shown
after saving; leaving the field blank keeps the stored key. **Save &
Sync Models** pulls the provider's model catalog so the diagnosis sheet
offers real model names.

![AI provider settings](/screenshots/settings-ai.png)

## Ingress

The ingress view shows which server terminates public traffic and the
failover state. App hostnames stay identical across servers regardless
(see [Servers](/docs/servers)).

## Next steps

- Read [System Configuration](/docs/system-config) for env/file settings.
- Read [Alerts](/docs/alerts) to wire SMTP into notifications.
