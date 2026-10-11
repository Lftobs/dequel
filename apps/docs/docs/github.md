---
title: GitHub Integration
category: Integrations
description: Repo picker, push-to-deploy webhooks, and fix pull requests.
slug: github
---

Connect a GitHub OAuth app once, and Dequel picks repos, installs
push-to-deploy webhooks, and opens AI fix pull requests on your behalf.

## Setup

Open **Settings → GitHub** and save the OAuth app credentials (client
ID, client secret, app name, webhook secret). The page shows the exact
callback URL to register in **GitHub → Settings → Developer settings →
OAuth Apps** and walks through creating the app.

Then click **Connect GitHub** (in Settings or in the project wizard) to
authorize with `repo`, `read:org`, and `admin:repo_hook` scopes.
Dequel stores the token server-side and shows a connected badge.

## What it unlocks

- **Repo picker** — in the project wizard, choose **GitHub Account**
  instead of pasting URLs: search your repos, and Dequel fills in the
  clone URL, branch, and project name.
- **Push-to-deploy** — toggle **Auto-deploy** on the Deployments tab.
  Dequel registers a webhook (`/api/github/webhook`, HMAC-verified with
  your secret) that rebuilds the project on every push to the tracked
  branch.
- **Fix pull requests** — [AI Diagnosis](/docs/ai-diagnosis) can open a
  `dequel-fix/*` branch and PR against your repo when it determines the
  failure is in your code. Requires the connected account to have push
  access.

Disconnect any time from the same tab; webhooks already installed keep
working until removed.

## Next steps

- Read [Deployments](/docs/deployments) for manual and auto deploys.
- Read [AI Diagnosis](/docs/ai-diagnosis) for the fix-PR flow.
