---
title: Configuration
category: Getting Started
description: Configure compute bounds, custom ports, and service specs.
slug: configuration
---

Dequel provides fine-grained control over container resources and network routing to ensure optimal application performance and stability.

## Resource Limits

Configure boundary limits under the Settings layout to avoid cluster resource starvation or application OOM (Out Of Memory) crashes:

- **CPU Limit (cores):** The maximum amount of CPU shares a container replica can consume. Specifying `1.0` permits a full single core.
- **Memory Limit (MB):** The boundary RAM limit allocated. If a container exceeds this, it is automatically terminated with an OOM error code and restarted. Recommended default: `512MB`.

## Port Configurations

Dequel's edge router (Caddy) uses reverse proxy routing to map incoming HTTP request traffic to your container.

<div class="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-zinc-300 space-y-1">
  <span class="font-bold text-amber-500 uppercase tracking-wider text-[10px]">⚠️ Crucial Note: Internal Ports</span>
  <p>Your application inside the container must bind to the environment-injected <code>PORT</code> variable. Hardcoding listen ports to <code>3000</code> or <code>8080</code> without reading the environment variable will result in a <strong>502 Bad Gateway</strong> error, as Caddy's dynamic routing target won't match.</p>
</div>

## Example: Express server

<div class="rounded-xl border border-border bg-[#070709] overflow-hidden">
  <div class="bg-[#0b0b0f] px-4 py-2 border-b border-border flex items-center justify-between">
    <span class="text-[10px] font-mono text-zinc-500">server.js</span>
  </div>
  <pre class="p-4 font-mono text-[11px] text-zinc-300 overflow-x-auto"><code>const express = require('express');
const app = express();

// ALWAYS read from process.env.PORT
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from Dequel!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});</code></pre>
</div>

<div class="pt-6">
  <a href="/docs/deployments" class="inline-flex items-center gap-2 bg-[#0c0c0e] hover:bg-[#121215] text-foreground border border-border font-semibold px-4 py-2 rounded-xl transition-all text-xs">
    Next: Deployments
    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
  </a>
</div>
