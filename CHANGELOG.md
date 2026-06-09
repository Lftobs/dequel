# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-08

### Added

- Initial deployment platform with Git, ZIP, and Docker Compose source deploy
- Automatic build detection via Railpack
- Managed PostgreSQL and MySQL database provisioning
- Custom domain attachment with automatic SSL via Caddy/Let's Encrypt
- CPU-threshold based horizontal auto-scaling with configurable cooldown
- Per-project environment variable management with redeploy hooks
- Persistent Docker volume attachments
- Full observability stack: Prometheus, Loki, Grafana, cAdvisor
- CPU/memory threshold alerts via email or webhook
- API key management for programmatic access
- Job queue via Redis for async operations
- Deployment rollback support
- Boot-time reconciliation of container state
- Unified project versioning via root `VERSION` file and `sync-versions` script
- `CHANGELOG.md` for tracking releases
- One-command install script (`install.sh`) for quick setup
- Automated release pipeline via GitHub Actions (builds Docker images, publishes to GitHub Container Registry, creates GitHub Releases)
- Changelog page in documentation site
- Vercel deployment configuration for documentation site

### Changed

- `docker-compose.yml` now references versioned images from `ghcr.io/dequel/*` with local build as fallback
- README updated with new install flow

### Fixed

- Railpack build timeout handling and log scrolling

[0.1.0]: https://github.com/tobshub/dequel/releases/tag/v0.1.0
