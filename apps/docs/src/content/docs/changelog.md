---
title: Changelog
category: Release
description: All notable changes to Dequel, tracked per release.
slug: changelog
---

## 0.2.0 — 2026-07-17

### Features

- PAM-based SSH authentication for project deployments
- Deploy to a specific commit SHA, not just branch HEAD
- Drizzle ORM migrations and a new deploy UI
- Toggle to clear build cache on next deploy
- `dequel update` command for self-updating the platform
- Mobile-responsive navigation and layouts
- Automatic cleanup of old Docker images and build artifacts

### Improvements

- GitHub OAuth now persists sessions across restarts and auto-detects the public URL from proxy headers
- PAM authentication moved to a standalone HTTP service for reliability
- Auth timeout and libc compatibility fixes
- Grafana dashboards and logging overhauled
- Install script improved for broader shell compatibility
- GitHub repo picker simplified to owner-affiliated repos only
- Docs navigation reorganized and UI polished

### Bug Fixes

- Migration errors and UI log display issues resolved
- Project deletion now properly cascades to related records

## 0.1.1 — 2026-06-19

### Added

- Per-project Grafana dashboards automatically created on successful deployment
- Configurable `CADDY_BASE_DOMAIN` for public ingress with automatic Let's Encrypt SSL
- Dynamic `railpack.json` generation with deployment abort support
- GitHub webhook management and project management API endpoints
- Project source and port configuration options
- SMTP configuration and system settings API

### Changed

- Monitoring stack hardened: Prometheus now validates TSDB blocks and quarantines corrupted ones on startup
- `PUBLIC_URL` is now derived from `CADDY_BASE_DOMAIN` instead of requiring separate configuration
- Refactored infrastructure monitoring configs into dedicated files for maintainability

### Fixed

- Container network reconciliation now force-disconnects stale network references before starting containers

## 0.1.0 — 2026-06-08

### Added

- Initial deployment platform with Git, ZIP, and Docker Compose source deploy
- Automatic build detection via Railpack
- Managed PostgreSQL and MySQL database provisioning
- Custom domain attachment with automatic SSL via Caddy / Let's Encrypt
- CPU-threshold based horizontal auto-scaling with configurable cooldown
- Per-project environment variable management with redeploy hooks
- Persistent Docker volume attachments
- Full observability stack: Prometheus, Loki, Grafana, cAdvisor
- CPU / memory threshold alerts via email or webhook
- API key management for programmatic access
- Job queue via Redis for async operations
- Deployment rollback support
- Boot-time reconciliation of container state
- Unified project versioning via root `VERSION` file and sync script
- `CHANGELOG.md` for tracking releases
- One-command install script (`install.sh`) for quick setup
- Automated release pipeline via GitHub Actions
- Changelog page in documentation site
- Vercel deployment configuration for documentation site

### Changed

- `docker-compose.yml` now references images from `ghcr.io/dequel/*` with local build as fallback
- README updated with new install flow

### Fixed

- Railpack build timeout handling and log scrolling

