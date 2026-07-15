---
title: Environment Variables
category: Core Architecture
description: Inject configuration values, API keys, and connection credentials securely into container environments.
slug: env-vars
---

Environment variables decouple application configurations from source code repositories. Secrets (like payment gateways, SMTP credentials, or database passwords) must always be injected this way to preserve security.

## Adding Variables

In the project console, click the **Environment Variables** tab:

- Enter a key name (e.g. `STRIPE_SECRET_KEY`). Key names should contain only alphanumeric characters and underscores.
- Enter the value. All values are securely stored and encrypted in the cluster database.
- Click **Add Variable**.

<div class="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs text-zinc-300 space-y-1">
  <span class="font-bold text-primary uppercase tracking-wider text-[10px]">💡 Note: Masked Displays</span>
  <p>For security, all environment variable values are masked on load. Click the eye icon to reveal them, or copy them securely via the copy badge.</p>
</div>

## Redeployment Prompts

Because environment variables are injected during container startup, modifying or deleting variables requires a container restart to take effect.

Dequel displays a **Redeployment Warning Banner** at the top of the tab whenever variables are mutated. Click the **Redeploy Now** button on the banner to execute a zero-downtime rolling update with the new configurations.

