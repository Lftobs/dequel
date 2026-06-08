---
title: SSL Certificates
category: Networking & Security
description: Secure external traffic automatically with Let's Encrypt TLS/SSL certificates.
slug: ssl
---

Dequel enforces HTTPS encryption for all public endpoints. The cluster edge routing layer manages keys, handshakes, and automatic certificate acquisitions behind the scenes.

## How Certificates are Provisioned

Dequel interfaces directly with **Let's Encrypt** (a free, automated, open Certificate Authority):

1. When a custom domain is successfully verified, Dequel triggers Caddy's ACME certificate client.
2. Caddy performs an HTTP-01 challenge verification with Let's Encrypt servers.
3. Upon challenge completion, Let's Encrypt signs a valid SSL certificate.
4. Caddy saves the certificate to the cluster storage path and starts enforcing TLS/HTTPS handshakes.

## Automatic Renewals

Let's Encrypt certificates are valid for 90 days. Dequel's router checks certificates once daily and schedules automatic renewals 30 days before expiration, ensuring zero downtime and avoiding manual keys management.

<div class="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs text-zinc-300 space-y-1">
  <span class="font-bold text-primary uppercase tracking-wider text-[10px]">💡 Key Security Spec</span>
  <p>Dequel configures modern TLS 1.3 as the default cipher suite block, providing maximum security, fast TLS handshakes, and strict protection against legacy protocol exploits.</p>
</div>

## Troubleshooting SSL

If your domain status is stuck on `PENDING_SSL`:

- Verify that your DNS CNAME/A records have fully propagated.
- Ensure that no CDN service (e.g. Cloudflare proxy) is blocking HTTP ACME challenge endpoints (`/.well-known/acme-challenge/`).

<div class="pt-6">
  <a href="/docs" class="inline-flex items-center gap-2 bg-[#0c0c0e] hover:bg-[#121215] text-foreground border border-border font-semibold px-4 py-2 rounded-xl transition-all text-xs">
    Back to Intro
  </a>
</div>
