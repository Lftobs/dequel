---
title: Authentication & Access Control
category: Security
description: Linux-user login, short-lived sessions, and scoped API keys.
slug: auth
---

Dequel has two credential types: interactive login for the dashboard
(Linux users) and API keys for programmatic access (CI, scripts).

## Dashboard login

Dequel authenticates dashboard users against the host's Linux accounts
through PAM. Only members of the `dequel` group can sign in. Create a
user after installing:

```bash
sudo groupadd -f dequel
sudo useradd -m -s /bin/bash <username>
sudo passwd <username>
sudo usermod -aG dequel <username>
```

## Sessions

- **Access token** — a JWT in the `dequel_session` cookie, valid 15
  minutes (`HttpOnly`, `SameSite=Lax`, `Secure` behind HTTPS).
- **Refresh token** — a rotating opaque token in the `dequel_refresh`
  cookie, valid 7 days. Logging out invalidates it immediately.
- The dashboard silently refreshes the session and redirects to
  `/login` when both tokens are gone.

## API keys

For CI pipelines, scripts, and external tools, create keys on the
**Keys → API Tokens** page (see [Keys](/docs/keys)):

1. Generate a token with a label and scope (CI/CD, monitoring, or full
   admin).
2. Copy the `dql_...` token — it is shown once and stored hashed.
3. Send it as a Bearer token:

```bash
curl -H "Authorization: Bearer dql_<key>" https://dequel.example.com/api/projects
```

Keys carry read/write scopes enforced per HTTP method. Revoke a key any
time from the same page; deleting it breaks its integrations
immediately.

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | None | Sign in with username/password |
| `POST` | `/api/auth/logout` | Session | Sign out, invalidate refresh token |
| `POST` | `/api/auth/refresh` | Session | Rotate refresh token |
| `GET` | `/api/auth/me` | None | Current session status |
| `GET` | `/api/health` | None | Health check |

## Next steps

- Read [Keys](/docs/keys) for API tokens and the SSH key pool.
- Read [GitHub](/docs/github) for the OAuth repo connection.
