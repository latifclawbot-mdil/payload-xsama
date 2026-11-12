# XSAMA Content

Multi-tenant Payload CMS for the XSAMA project sites. One deployment, isolated
project tenants, per-tenant roles, and project-specific editorial collections.

## Tenants

`advista`, `exim`, `vlobel`, `afnosh`, `qasmos`, `zamindarr`, `nagerik`, `layyun`.

Tenants are created idempotently at startup if missing. Deleting a tenant never
cascades into its documents (`cleanupAfterTenantDelete: false`).

## Roles

Each user receives a role per tenant:

- `owner` — project settings, users, publishing, deletion
- `publisher` — create, edit, publish
- `editor` — create and edit drafts
- `reviewer` — review drafts, no publishing
- `viewer` — read published content
- `builder` — read-only published content for static builds

Cross-tenant authority is **default-deny** and requires the email to appear in
`PAYLOAD_OWNER_EMAILS`. A `globalRole` value alone is not enough.

## Content model

- `posts` — shared localized editorial
- `site-settings` — one document per tenant
- `case-studies`
- `packaging-guides`
- `fit-guides`
- `property-guides`
- `regulatory-notes`

All editorial collections use Payload drafts (`_status`). Public reads return
published documents only; tenant members see drafts according to role.

## Localization

`en`, `ar`, `de`, `es`, `fil`, `fr`, `hi`, `it`, `ja`, `ko`, `fa`, `pt`, `ru`,
`tr`, `ur`, `zh`. Localization fallback is disabled.

## Storage

Media is stored in S3-compatible storage via `@payloadcms/storage-s3`, under the
`media/` prefix in `S3_BUCKET`. Local disk storage is disabled. Production must
provide the S3 environment values; builds without them compile but uploads fail.

## Environment

See `.env.example`. Required:

- `DATABASE_URL`, `PAYLOAD_SECRET`, `PAYLOAD_PUBLIC_SERVER_URL`
- `PAYLOAD_OWNER_EMAILS`
- `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`

One-time owner bootstrap (ignored after the first user exists):

- `PAYLOAD_BOOTSTRAP_OWNER_EMAIL`
- `PAYLOAD_BOOTSTRAP_OWNER_PASSWORD`

Remove the bootstrap password after the first successful login.

## Database

Runtime uses `payload_mt_app`, which has no DDL rights. Migrations run as
`payload_mt_migrator`. Create a reviewed migration with:

```sh
pnpm payload migrate:create
```

Apply it through the release command:

```sh
pnpm payload migrate
```

The production container runs `pnpm payload migrate` before `pnpm start`.

## Static-site reads

A project build queries only its tenant and only published documents:

```text
GET /api/posts?where[tenant.slug][equals]=advista&where[_status][equals]=published&locale=en&fallback-locale=none&limit=100&depth=1
```

Use a dedicated `builder` user/API key per project where authenticated reads are
required. Never expose `PAYLOAD_SECRET` or S3 credentials to a frontend bundle.

## Deployment

Production runs through Coolify from the repository Dockerfile. The image applies
migrations, then starts Next. Health check: `/admin`.
