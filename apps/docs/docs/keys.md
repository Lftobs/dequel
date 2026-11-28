---
title: Keys & Tokens
category: Security
description: API tokens for automation and the SSH key pool for servers.
slug: keys
---

The **Keys** page is the credential control center: API tokens for
programmatic access, and the SSH key pool that server connections draw
from.

![Keys page](/screenshots/keys.png)

## API tokens

Generate a token with a label, a scope preset (CI/CD pipeline,
monitoring and logs, or full admin), and an optional project scope. The
`dql_...` token is shown **once** — copy it immediately; afterwards only
its hash prefix is listed. Send it as a Bearer token:

```bash
curl -H "Authorization: Bearer dql_<key>" https://dequl.example.com/api/projects
```

### Scopes

Scopes are enforced per HTTP method (read vs write). A token scoped to
one project is additionally limited to that project's resources and the
deployment list — deploy-only CI tokens cannot read or touch anything
else.

### Pause, roll, revoke

- **Pause / resume** disables a token without deleting it, ideal for
  freezing a CI pipeline temporarily. Paused tokens are rejected with
  `401`.
- **Roll** replaces the secret in place and shows the new token once —
  use it on a suspected leak instead of recreating the token and
  reconfiguring every consumer.
- **Revoke** deletes the token; anything using it fails immediately.

### OpenAPI reference

The full API contract is published as OpenAPI 3.1 and rendered by
Swagger UI:

- `GET /api/openapi.json` — the machine-readable spec (no auth needed).
- `GET /api/docs` — the interactive reference in the browser.

Both the session cookie and Bearer schemes are documented, so the
external-CI recipe is: create a project-scoped token, then drive
deploys and [webhooks](/docs/automation) from the reference page.

## SSH key pool

Servers connected over SSH authenticate with a key from this pool, not
with per-server pastes. Add a PEM/OpenSSH private key (paste or upload
`.pem` / `.key`); Dequl detects Ed25519/RSA formats, fingerprints the
key, and rejects duplicates. Private material is never displayed again
— only name, fingerprint, tags, and date.

When you add a server (**Settings → Servers**), pick its key from the
pool dropdown. Rotating a server's access means updating the pool entry
it points at.

## Next steps

- Read [Authentication](/docs/auth) for login sessions.
- Read [Audit Logs](/docs/audit-logs) to attribute token actions.
- Read [Servers](/docs/servers) to attach keys to machines.
