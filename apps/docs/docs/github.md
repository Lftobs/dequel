---
title: GitHub Integration
category: Integrations
description: Repo picker, push-to-deploy webhooks, fix pull requests, and Git credentials for any provider.
slug: github
---

Connect a GitHub OAuth app once, and Dequel picks repos, installs
push-to-deploy webhooks, and opens AI fix pull requests on your behalf.
GitLab, Bitbucket, Gitea/Forgejo, and self-hosted Git servers connect
without an integration through per-project HTTPS credentials.

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

## Any Git provider

Private repositories outside GitHub — GitLab, Bitbucket, Gitea,
Forgejo, or a company Git server — work without an integration:

1. In the wizard, select **Git Repository** and set the provider in the
   Git authentication fields (or leave it on auto-detect).
2. Paste a repository access token with read (clone) scope. Dequel
   encrypts it per project and uses it only to authenticate clones on
   the deployment node.

The provider setting maps the token to the username each host expects
(`x-access-token` for GitHub, `x-token-auth` for Bitbucket, `oauth2`
for GitLab and Gitea), and tokens can be updated later under
**Settings → General → Git Authentication** without recreating the
project. Push-to-deploy for these providers uses the generic
[deploy webhook](/docs/automation) instead of installed repo hooks.

:::note[GitHub App]
Fine-grained repository access via a GitHub App and pull-request
preview events are planned for a later release; per-repo tokens cover
private cloning today.
:::

## Next steps

- Read [Deployments](/docs/deployments) for manual and auto deploys.
- Read [Automation](/docs/automation) for provider-neutral webhooks.
- Read [AI Diagnosis](/docs/ai-diagnosis) for the fix-PR flow.
