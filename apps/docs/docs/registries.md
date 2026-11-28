---
title: Registries
category: Integrations
description: Credentials for pulling private Docker images.
slug: registries
---

**Settings → Registries** stores credentials for private container
registries. Projects that deploy a [prebuilt image](/docs/build-methods)
attach a saved registry, and Dockerfile builds log the server into the
registry so private base images resolve.

## Adding a registry

Give the registry a name, its host (`ghcr.io`, `registry.gitlab.com`,
`harbor.example.com`, ...), a username, and a password or token. Use a
read-only deploy token rather than a personal account where the
registry supports them. Credentials are AES-256-GCM encrypted at rest
and never displayed after saving.

During a deploy the pipeline logs the deployment node into the registry
(`docker login`), pulls the image, and continues. Registry credentials
never leave the control plane except for that login on the target node.

## Using a registry

- **Image projects** — pick the registry in the creation wizard or in
  **Build Strategy** settings. The pull policy still applies: `never`
  skips the pull entirely and requires the image to already exist on
  the node.
- **Dockerfile builds** — builds authenticate against the registry
  before building, so `FROM ghcr.io/org/private-base` works.

Remove a registry when its token is revoked; projects referencing it
fall back to public pulls.

## Next steps

- Read [Build Methods](/docs/build-methods) for image projects.
- Read [Notification Channels](/docs/notifications) for deploy events.
