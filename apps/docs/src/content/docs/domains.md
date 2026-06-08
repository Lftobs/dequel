---
title: Custom Domains
category: Networking & Security
description: Point custom web addresses to container deployment endpoints using DNS records.
slug: domains
---

Dequel provides public routing endpoints. You can route external domain request traffic (e.g. `app.mycompany.com`) by pointing DNS records to Dequel cluster host IP addresses.

## Step 1: Add Domain in Dequel Console

Under the **Domains** tab, click **Add Domain**, enter your custom domain address (e.g., `blog.mydomain.com`), and save.

## Step 2: Configure DNS Records

In your DNS registrar's control panel (Cloudflare, GoDaddy, Namecheap, etc.), add the record displayed in the instructions box:

- **For Subdomains:** Add a `CNAME` record pointing your subdomain (e.g. `blog`) to the cluster's base domain.
- **For Apex/Root Domains:** Add an `A` record pointing `@` directly to the Dequel cluster server IP.

<div class="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs text-zinc-300 space-y-1">
  <span class="font-bold text-primary uppercase tracking-wider text-[10px]">💡 Note: DNS Propagation</span>
  <p>DNS changes can take up to 24–48 hours to propagate globally. Dequel will run automated validation checks in the background until the records resolve correctly.</p>
</div>

## Validation Statuses

- **Pending:** Dequel is awaiting DNS propagation.
- **Verified:** DNS records resolve correctly. The proxy router is configured.
- **Failed:** Resolving record targets did not match the required target targets. Check your DNS values.

<div class="pt-6">
  <a href="/docs/ssl" class="inline-flex items-center gap-2 bg-[#0c0c0e] hover:bg-[#121215] text-foreground border border-border font-semibold px-4 py-2 rounded-xl transition-all text-xs">
    Next: SSL Certificates
    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
  </a>
</div>
