---
title: AI Diagnosis
category: Deployment
description: Diagnose failed builds with an AI agent, then apply one-click fix PRs or report Dequel bugs.
slug: ai-diagnosis
---

When a deployment fails, Dequel lets you hand the failure to an AI agent. The agent runs inside an isolated sandbox container holding a fresh checkout of Dequel's own source and your project's source. It looks up the files it needs itself, decides whether the fault is in your code or in Dequel itself, and proposes what to do next. Every write action requires your explicit click.

The sandbox persists between diagnoses: Dequel's source is cloned once and updated to your running version on each run, while your project's source is pulled fresh per diagnosis and cleared afterwards.

## Configure a provider key

Before diagnosing anything, store an LLM provider key. Open **Settings → AI Diagnosis** and save a key for one of the supported providers (`openai`, `anthropic`, `gemini`, `groq`, or a custom OpenAI-compatible endpoint with a base URL). Keys are encrypted at rest and never shown again after saving. Leaving the key field empty keeps the stored key.

## Diagnose a failed deployment

Follow these steps to run a diagnosis.

1. Open the project and switch to the **Deployments** tab.
2. Select a failed deployment to reveal its build logs.
3. Click **Diagnose** in the log header to open the diagnosis sheet.
4. Pick a provider and model, then click **Diagnose**.
5. Watch the agent work through four stages: reading logs, investigating in the sandbox, explaining the fix, and drafting the proposal.
6. Read the verdict and the explanation.

The verdict is one of three outcomes. **Your code** means the fault is in your source. **Dequel** means the fault is in Dequel's builder or platform code. **Inconclusive** means the evidence was not sufficient, and no action buttons are shown.

## Fix your code with one click

When the verdict is **Your code** and the project deploys from Git, the sheet shows a **Create fix PR** button. Clicking it sends the agent back into the sandbox to edit the project source, still read-only everywhere else. Dequel takes the resulting diff, applies it to a new `dequel-fix/*` branch, and opens a pull request against your repository, so you only review and merge. If the agent cannot produce a change, or the diff does not apply cleanly, Dequel reports the problem and you apply the fix manually. This action is idempotent: repeated clicks return the same pull request.

> **Note:** Fix PRs require a connected GitHub account with repository access. Connect it under **Settings → GitHub Integration** first. Without it, Dequel refuses to proceed.

## Report a Dequel bug

When the verdict is **Dequel**, Dequel posts the drafted report to the Dequel team's Slack channel automatically as soon as the diagnosis completes — no button, no approval step. The post carries the report in problem, Dequel version, root cause, proposed fix order, with the investigated source revision attached. If the channel is not configured, the run still completes and the sheet says so; copy the report text and share it manually.

## Limits

- Diagnosis runs only on deployments with `failed` status.
- One diagnosis exists per deployment and commit; starting it again returns the existing result.
- Fix PRs are available for Git projects only. Zip-upload projects still receive the written explanation.
- The sandbox agent pulls only the files it needs (12 KB per read, 40 search hits at a time) and can keep working through large repositories across many steps. What bounds it instead is time and cost: a run times out after about 10 minutes, and every file read spends your provider's tokens.
- The sandbox agent has read-only file access. It cannot run commands, reach the network, or see your provider key's surroundings.

## Next steps

- Read [Deployments](/docs/deployments) to understand build sources and rollback.
- Read [Configuration](/docs/configuration) for platform settings.
