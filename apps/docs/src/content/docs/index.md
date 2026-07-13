---
title: Introduction
category: Getting Started
description: Dequel is an open-source, developer-centric cluster container orchestrator designed to deploy, run, and scale web applications, APIs, and background workers.
slug: docs
---

Dequel provides developers with a Heroku-like platform experience on top of virtualized docker runtimes and cluster node providers. You get the simplicity of automated Git triggers, built-in let's encrypt SSL proxy routing, and direct persistent volume attachments without wrestling with complex Kubernetes configurations.

## Core Philosophy

- **Zero-Config Routing:** Incoming traffic is automatically proxied to active deployments based on project configuration.
- **State Isolation:** Web containers are designed to be ephemeral. Persistent state is kept cleanly separated in managed databases or mapped node volumes.
- **Self-Healing Runtimes:** Failed container instances are automatically replaced, and scaling adjustments occur automatically based on CPU usage.

<div class="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs text-zinc-300 space-y-1">
  <span class="font-bold text-primary uppercase tracking-wider text-[10px]">💡 Key Concept: Projects</span>
  <p>A Project in Dequel represents a single service (a container build) along with its environment configurations, database attachments, routing domains, and active deployments.</p>
</div>

## How Dequel Works

When you connect a repository or upload a folder:

1. Dequel reads your project's code directory and looks for a `Dockerfile` or builder configurations.
2. It initiates a secure cluster builder environment to package your container image.
3. The container image is pushed to the local cluster registry and distributed across running nodes.
4. Caddy routing endpoints are automatically updated to direct traffic to the newly created instance ports.


