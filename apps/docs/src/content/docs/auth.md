---
title: Authentication & Access Control
category: Networking & Security
description: Secure your Dequel dashboard with PAM-based authentication, session management, and API keys.
slug: auth
---

Dequel authenticates users against the **Linux system user database** via PAM (Pluggable Authentication Modules). Only users who are members of the `dequel` group can sign in.

## User Setup

Create a Linux user and add them to the `dequel` group:

```bash
sudo useradd -m -s /bin/bash <username>
sudo passwd <username>
sudo usermod -aG dequel <username>
```

The user signs into the Dequel dashboard with their Linux username and password.

## Session Management

- **Access tokens**: Short-lived (15 min) HMAC-SHA256 JWTs stored in an `httpOnly` cookie.
- **Refresh tokens**: Long-lived (7 days) random tokens stored in the database. Automatically rotated on refresh.
- **Token blacklisting**: Logging out or refreshing invalidates the old refresh token immediately.
- **JWT secret**: Auto-generated on first API startup, stored at `data/.jwt_secret` (0600 permissions). Deleting this file invalidates all sessions.

## API Keys

For programmatic access (CI/CD, CLI tools), Dequel uses pre-shared API keys:

1. Go to **Settings → API Keys** in the dashboard.
2. Create a new key — the full token is shown once.
3. Use it as a Bearer token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer dqk_<key>" https://dequel.example.com/api/projects
```

API keys are scoped to the entire platform with the same permissions as the user who created them.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | None | Sign in with username/password |
| `POST` | `/api/auth/logout` | Session | Sign out, blacklist refresh token |
| `POST` | `/api/auth/refresh` | Session | Rotate refresh token |
| `GET` | `/api/auth/me` | None | Check current session status |
| `GET` | `/api/health` | None | Health check |

The web dashboard redirects to `/login` when no valid session is detected.
