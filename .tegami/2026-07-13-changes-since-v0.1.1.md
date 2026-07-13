---
packages:
  npm:dequel-api: minor
  npm:dequel-web: minor
  npm:dequel-docs: minor
---

## What's Changed

### New Features

- feat(api): add PAM auth and token utilities
- feat(deploy): support specific commit deployments and cache clearing
- feat(api): add drizzle migrations and deploy UI
- feat(deployments): add ClearCacheToggle UI

### Improvements

- refactor(api): switch PAM auth to HTTP service
- refactor(auth): add timeout and libc fixes
- refactor(grafana): overhaul dashboards and logging
- chore(scripts): improve shell compatibility in installer

### Bug Fixes

- fix: robust migration and UI log tweaks
- fix(api): fix project deletion cascade
