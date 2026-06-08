---
title: Deployments
category: Core Architecture
description: Trigger builds, view active execution logs, and roll back code changes.
slug: deployments
---

Dequel supports two primary methods for deploying code changes: automated tracking via **Git repository branches**, and **manual zip uploads** directly from the local filesystem.

## Git Integration

Configure a Git repository URL (e.g. `github.com/my-org/my-project`) and specify a branch name (e.g. `main`).

- **Automated webhook updates:** Dequel listens to push events to rebuild automatically.
- **Manual triggers:** Click the **Deploy Branch** CTA in the UI to manually queue a build of the latest commit.

## Manual File Directory Uploads

If your code is not stored in a public repository, or you want to test local modifications immediately:

1. Drag and drop your local directory as a compressed `.zip` archive.
2. Dequel uploads the file payload directly to the builder API node.
3. The archive is unpacked and fed straight into the Docker build engine.

## Active Logs & Rollbacks

Each deployment creates an isolated, immutable build artifact.

- **Build Logs:** View the live compiler steps as Docker pulls layers, executes commands, and builds cache images.
- **Zero-Downtime Rollbacks:** Instantly switch traffic back to a previous build artifact by clicking the **Promote** button on any previously successful deployment.

<div class="pt-6">
  <a href="/docs/env-vars" class="inline-flex items-center gap-2 bg-[#0c0c0e] hover:bg-[#121215] text-foreground border border-border font-semibold px-4 py-2 rounded-xl transition-all text-xs">
    Next: Environment Variables
    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
  </a>
</div>
