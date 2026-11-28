---
title: Automation
category: Projects
description: Deploy webhooks, project tags, and maintenance mode.
slug: automation
---

The **Settings → Automation** section lets external CI and schedulers
trigger deployments without a provider integration, group projects for
bulk deploys, and park a project behind a maintenance page.

## Deploy webhook

Every project has a secret deploy URL:

```
POST https://dequl.example.com/api/webhooks/deploy/<token>
```

No auth header is needed — the token in the URL is the credential. An
optional JSON body picks a branch; omit it to deploy the project's
configured branch:

```bash
curl -X POST https://dequl.example.com/api/webhooks/deploy/<token> \
  -H "Content-Type: application/json" \
  -d '{"branch": "main"}'
```

Works for Git and [image](/docs/build-methods) projects alike. **Rotate**
replaces the token immediately and invalidates the old URL — do this if
a URL leaked or a CI job was retired. The full URL (including token) is
copied from the Automation section.

## Tags

Tags are free-form labels (lowercased, up to 20 per project) attached in
the Automation section. One call deploys every project sharing a tag:

```bash
curl -X POST -H "Authorization: Bearer dql_<key>" \
  https://dequl.example.com/api/projects/by-tag/frontend/deploy \
  -H "Content-Type: application/json" \
  -d '{"branch": "main"}'
```

Projects that cannot start are reported per-project in the response
instead of failing the batch. Tags also accept a comma-separated list
for CLI export and future staged-deploy features.

## Maintenance mode

Toggling **Maintenance Mode** stops Caddy from proxying traffic to the
running container and instead returns `503` with your message on every
domain of the project. The container keeps running — deploys, health
checks, and rollbacks continue as usual — so you can upgrade a database
or warm caches behind the page. Turn it off to resume routing.

## Next steps

- Read [GitHub](/docs/github) for the push-to-deploy webhook.
- Read [Keys & Tokens](/docs/keys) for authenticating batch calls.
