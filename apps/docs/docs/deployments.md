---
title: Deployments
category: Projects
description: Trigger builds, follow live logs, and roll back releases.
slug: deployments
---

A deployment is one build-and-run cycle of your project. The project's
**Deployments** tab lists the full history with status, source, branch,
duration, and age, and lets you manage each one.

## Deployment sources

**Git.** Point the project at a repository URL and branch (or pick a repo
through the GitHub integration). New pushes rebuild automatically when
the webhook is connected — toggle **Auto-deploy** on the Deployments
tab. **Manual Deploy** rebuilds from the latest commit or a specific
SHA, with an option to clear the BuildKit cache.

**Upload.** Drop a `.zip` (at creation) or `.zip` / `.tar` / `.tar.gz`
(on the Deployments tab) to deploy local code. An upload project can be
migrated to Git later from the same tab without losing history.

**Docker Compose.** Repos with a `docker-compose.yml` build all services
together; only the mapped ingress services get public URLs (see
[Project Configuration](/docs/configuration)).

## Lifecycle

Deployments move through `pending` → `building` → `deploying` →
`running`. A failed build ends in `failed`; you can `cancel` a queued or
active build. Only one deployment is live per project — each successful
deploy replaces the previous container.

Click a row to expand its **build logs**, streamed live while the build
runs and stored afterwards. The **Runtime Logs** view (under the
**Logs** tab) shows the running container's stdout instead.

## Redeploy, rollback, delete

- **Redeploy** clones the currently running deployment (same image and
  config) — the standard way to apply changed env vars or volumes.
- **Rollback** points the route back at an earlier deployment's image.
  Images are kept, so rollback is instant and does not rebuild.
- **Delete** destroys a deployment's containers. The running deployment
  cannot be deleted.

## Failed builds and AI diagnosis

If a deployment fails, the log header shows a **Diagnose** button. It
opens the AI diagnosis sheet: pick a configured LLM provider and model,
and the agent investigates the logs, decides whether the fault is your
code or the platform, and can open a fix pull request on your repo. See
[AI Diagnosis](/docs/ai-diagnosis).

## Next steps

- Read [AI Diagnosis](/docs/ai-diagnosis) for the failure workflow.
- Read [Observability](/docs/observability) for logs and metrics.
