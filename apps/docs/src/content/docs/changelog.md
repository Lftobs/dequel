---
title: Changelog
category: Release
description: All notable changes to Dequel, tracked per release.
slug: changelog
---

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
