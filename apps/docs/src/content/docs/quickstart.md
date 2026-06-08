---
title: Quickstart Guide
category: Getting Started
description: Deploy your first containerized application to Dequel in under 5 minutes.
slug: quickstart
---

In this guide, we'll configure a project, push the codebase, and verify that the container is running with active routing.

## Step 1: Create a Project

Navigate to the Dequel dashboard (normally hosted at `localhost:5173`) and click the **+ Create Project** button in the upper right corner.

- Enter a unique project name (e.g. `my-web-app`).
- Configure CPU limit boundaries (e.g., `0.5 cores`) and Memory bounds (e.g., `512MB`).
- Click **Create** to initialize the project namespace.

## Step 2: Add a Dockerfile

Dequel builds applications using a standard container blueprint. Ensure your project includes a valid `Dockerfile` in its root directory:

<div class="rounded-xl border border-border bg-[#070709] overflow-hidden">
  <div class="bg-[#0b0b0f] px-4 py-2 border-b border-border flex items-center justify-between">
    <span class="text-[10px] font-mono text-zinc-500">Dockerfile</span>
  </div>
  <pre class="p-4 font-mono text-[11px] text-zinc-300 overflow-x-auto"><code>FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start"]</code></pre>
</div>

<div class="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-zinc-300 space-y-1">
  <span class="font-bold text-emerald-400 uppercase tracking-wider text-[10px]">💡 Pro Tip: Custom Ports</span>
  <p>Dequel reads the <code>PORT</code> environment variable inside your container to automatically route incoming traffic. Ensure your app listens on the port specified by this variable.</p>
</div>

## Step 3: Trigger the Deploy

On the deployments page, you can choose between connecting your GitHub repository or performing a local directory upload:

1. Enter your repository URL and set the branch to `main`.
2. Click **Deploy Branch**.
3. Follow the build stages in real-time under the **Active Build Logs** window.

## Step 4: Verify Routing

Once the deployment changes status from `BUILDING` to `READY`, click the external link button near your custom domain or the auto-generated base domain to see your running web container.

<div class="pt-6">
  <a href="/docs/configuration" class="inline-flex items-center gap-2 bg-[#0c0c0e] hover:bg-[#121215] text-foreground border border-border font-semibold px-4 py-2 rounded-xl transition-all text-xs">
    Next: Configuration
    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
  </a>
</div>
