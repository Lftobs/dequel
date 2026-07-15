---
title: Scaling Policies
category: Core Architecture
description: Adjust running container replicas automatically to handle high traffic and preserve cluster efficiency.
slug: scaling
---

Dequel supports two types of container instance scaling: **Manual Scaling** (fixed replica count) and **Auto-scaling** (load-based replica counts).

## Manual Scaling

Configure a static replica limit for your service (e.g. `3 replicas`). The orchestrator will verify that exactly three instances are running on cluster nodes. If an instance crashes, it will be automatically replaced immediately.

## Auto-scaling Policies

Auto-scaling lets you scale compute bounds in response to real-time resource demands:

- **Min Replicas:** The baseline floor of instances always running.
- **Max Replicas:** The maximum horizontal scale ceiling allowed under load.
- **Target CPU Utilization (%):** The load threshold trigger. If average CPU utilization exceeds this value (e.g. `70%`), new container replicas are provisioned. If the load falls below the target, containers are scaled down.

<div class="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-xs text-zinc-300 space-y-1">
  <span class="font-bold text-rose-400 uppercase tracking-wider text-[10px]">⚠️ Warning: Stateless Design Required</span>
  <p>To scale horizontally, your application container must be completely stateless. Avoid writing file records directly to the local filesystem; use persistent volumes or managed databases instead.</p>
</div>

## Configuration Modal

To disable auto-scaling policies or switch back to static scaling, click **Delete Policy** in the scaling panel. Confirm the change in the custom Radix confirmation dialog to update the scaling configuration safely.

