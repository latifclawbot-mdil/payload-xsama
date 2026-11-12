# Container releases

Production runs a prebuilt image from GitHub Container Registry. Coolify does not build this application from source.

## Published image

`ghcr.io/latifclawbot-mdil/payload-xsama`

Every push to `master` runs `.github/workflows/publish-container.yml` and publishes one immutable tag:

```text
sha-<full 40-character commit SHA>
```

There is no `latest` or moving branch tag. A commit SHA always identifies the same image content.

## Production promotion

1. Merge the change to `master`.
2. Wait for **Publish production container** to pass.
3. Read the immutable tag from the workflow summary, for example:

   ```text
   sha-b275399d04854bdc58e83569fb48521f2cd947fd
   ```

4. In Coolify, open `xsama-content` and change **Docker Image Tag** to the new tag.
5. Deploy and require the health check on `/admin` to pass.
6. Verify the canonical site and API, then record the previous tag for rollback.

Production promotion is deliberately manual. A successful build does not deploy itself.

## Rollback

Set **Docker Image Tag** back to the previous `sha-...` value and deploy. Images are retained in GHCR; do not delete a release while it can still serve as a rollback target.

Database migrations run from the container entrypoint before the server starts. A code rollback does not reverse a destructive schema migration, so every migration must remain backward-compatible for at least one release.

## Registry access

The deployment server authenticates to `ghcr.io` through the Coolify server registry login. If a pull fails with `unauthorized`, run:

```text
POST /api/v1/servers/<server-uuid>/registries/ghcr.io/check
```

and refresh the login if the GitHub token has expired or lost package access.

## Why the application layer is required

`payloadcms/payload` is the framework monorepo. Its release tags identify package versions, not a runnable CMS. This repository supplies the application configuration, collections, access rules, locales, plugins, and deployment entrypoint that make an image runnable.
