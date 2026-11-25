# Localization pipeline (Windmill → LiteLLM → Payload → tenant build)

Editorial flow for a multi-language blog. **The English article is the only thing
an editor writes.** Everything after it is machine work with an explicit gate.

```
editor publishes EN post in Payload
        │
        │  (1) Posts afterChange → POST /api/internal/pipeline/translation-request
        ▼
Windmill flow  `f/localize-post`   (script: scripts/windmill/f_localize_post.ts)
        │  (2) read the published EN post, then per target locale:
        │      LiteLLM /v1/chat/completions with the whole article as JSON
        ▼
        │  (3) POST /api/internal/translations   (bearer + CF Access service token)
        ▼
translation rows land in posts_locales / posts_tags
        │
        │  (4) POST the tenant's Netlify build hook — only when EVERY locale landed
        ▼
tenant site rebuilds with every language live
```

## Verified environment facts

Measured on the live homelab, not assumed:

| Fact | Value |
| --- | --- |
| Windmill | CE **v1.862.0**, Coolify service `uhx0cgvsjyqcnk2kkav12dcp`, `windmill.xsama.org` |
| Windmill workers | **one**, `default` group, embedded in the server container (1.0 CPU / 1536 MB); `custom_tags=["chromium"]` |
| Windmill auth | **email+password only** — no `SUPERADMIN_SECRET`, no `WM_TOKEN`, `token` table empty; `windmill token` is not a subcommand in 1.862.0 |
| LiteLLM | `ghcr.io/berriai/litellm:v1.110.2`, `https://proxy.xsama.org/v1`, 24 DB-stored models |
| Windmill → LiteLLM | **public hostname only** — Windmill (`uhx0cgvs…`, 172.20.0.2) and LiteLLM (`coolify`, 172.18.0.4) share no docker network; the container IP times out |
| Payload reads | `GET /api/posts` is **public (200)** |
| Payload writes | `/api/tenants`, `/api/pages`, `/api/globals`, `/api/users/me`, and the `/api/internal/*` endpoints all **302 to Cloudflare Access** |
| IPv6 | container has **no IPv6 route** but DNS answers AAAA first — use a Happy-Eyeballs client (`fetch`/undici is fine); a naive client can hang |
| Outbound | `api.netlify.com/api/v1/sites` → 401 (reachable, auth required), `hub.windmill.dev` → 200 |

## Why a dedicated endpoint instead of the Local API

A localized `payload.update` on an already-published document is a no-op on this
Payload build: the localized values are merged and then written back under the
same locale. Translations written that way return success and vanish. The intake
endpoint writes the `posts_locales` / `posts_tags` rows directly — the write
translation actually needs — and never touches `en`.

## Contract: `POST /api/internal/translations`

Headers: `Authorization: Bearer $PAYLOAD_PIPELINE_TOKEN` (unset ⇒ route 503s) and
`CF-Access-Client-Id` / `CF-Access-Client-Secret`.

```json
{
  "tenant": "zamindarr",
  "posts": [
    {
      "slug": "rera-2025-buyers-first",
      "locale": "hi",
      "title": "…",
      "excerpt": "…",
      "seoTitle": "… (≤70)",
      "seoDescription": "… (≤165)",
      "tags": ["…"],
      "blocks": [{ "p": "…" }, { "h2": "…" }, { "ul": ["…"] }]
    }
  ]
}
```

Enforced server-side:

- `locale` must be a translation target (`hi, kn, gu, ta, te, ml`); `en` is
  refused — the source language is never machine-written.
- The post must already exist **in that tenant**; the endpoint never creates posts.
- `seoTitle` ≤ 70, `seoDescription` ≤ 165 — the same limits the CMS field applies,
  so a machine translation cannot silently produce an unindexable page.
- Only `p` / `h2` / `ul` blocks — no HTML, no uploads, no links injected by a model.
- Max 25 posts per call, 200 blocks per post, 20 tags per post.
- Idempotent: identical content reports `"action": "unchanged"` and writes nothing.

## Contract: `POST /api/internal/pipeline/translation-request`

Called by the posts `afterChange` hook when a post is first published, or by an
operator replay with the bearer token. It does not translate; it asks Windmill to.
Returns `202` on acceptance, `503` when `WM_TRANSLATION_WEBHOOK` is unset, and the
reason when it declines (`not_published`, `no_target_locales`, …).

## The gate: build only after every locale lands

The build hook fires from the flow's last step, not from the publish event, so a
site never rebuilds half-translated. The flow throws if intake reports a locale
missing, and the check script proves both the happy path and each abort path.

Each tenant site also declares how many locales it serves — Zamindarr:
`en, hi, kn` with `baseline: { en: 5, hi: 5, kn: 5 }` — so the static adapter
fails the build on an empty locale instead of shipping a blank page.

## Setup checklist (all four are required before the flow can run)

1. **Windmill API token** — the hard blocker for automation: there is no CLI path
   in 1.862.0 and the `token` table is empty. Mint one from the UI as
   `admin@windmill.dev` (or paste it into the vault) before creating the script,
   the resources, or the webhook trigger.
2. **LiteLLM virtual key** scoped to the translation model, created in the LiteLLM
   admin UI (auth there is OIDC-backed, so a CLI shortcut is not available).
3. **Cloudflare Access** — two directions:
   - *Inbound*: a bypass policy for the Windmill webhook path, or the trigger 302s
     to the Access login and never runs.
   - *Outbound*: a service token added to the `payload` resource, or every CMS
     write 302s. `GET /api/posts` is the only path that works anonymously.
4. **Per-tenant Netlify build hooks** — opaque per-site IDs; they cannot be
   discovered (`api.netlify.com` returns 401 without a token) and must be supplied
   in the `builds` resource. Do not assume one global hook.

## Operating notes

- Create the Windmill script with explicit tags; jobs inherit
  `custom_tags=["chromium"]` and will queue forever if they land on a worker that
  does not advertise it.
- Secrets live in Windmill resources, never in the flow script.
- The whole flow is proven locally: `node --experimental-strip-types
  scripts/windmill/run-flow.check.ts` runs it against fake LiteLLM/CMS/build-hook
  servers and asserts the build fires last, exactly once, and never on a failure.
