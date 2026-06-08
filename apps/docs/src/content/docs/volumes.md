---
title: Persistent Volumes
category: Cluster Storage & Data
description: Mount persistent cluster disk pathways inside container runtimes to preserve storage across updates.
slug: volumes
---

Dequel container instances are ephemeral by default. When a new deployment occurs, the old container is deleted, taking all local filesystem changes with it.

To store uploaded assets, databases, or local file caches, mount a **Persistent Volume**.

## Creating a Volume Mount

Under the **Volumes** tab, click **Add Volume**:

1. Enter a mount path inside the container environment (e.g. `/app/uploads`).
2. Click **Add Volume**.
3. Dequel allocates block storage space on the cluster nodes and maps it to your container's target folder.

<div class="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs text-zinc-300 space-y-1">
  <span class="font-bold text-primary uppercase tracking-wider text-[10px]">💡 Note: Redeployment Requirement</span>
  <p>Adding or deleting volumes modifies the low-level container host bindings. To apply these mount pathways, you must trigger a container restart via the <strong>Redeploy Now</strong> prompt banner at the top of the volumes tab.</p>
</div>

## Data Security & Backups

Because data is tied directly to cluster block volumes, data persists even if you update environment variables, scale container replicas, or deploy code rollbacks.

<div class="pt-6">
  <a href="/docs/domains" class="inline-flex items-center gap-2 bg-[#0c0c0e] hover:bg-[#121215] text-foreground border border-border font-semibold px-4 py-2 rounded-xl transition-all text-xs">
    Next: Custom Domains
    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
  </a>
</div>
