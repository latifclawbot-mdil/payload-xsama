# Localization pipeline (Windmill → LiteLLM → Payload → tenant build)

Editorial flow for a multi-language blog. **The English article is the only thing
an editor writes.** Everything after it is machine work with an explicit gate.

```
editor publishes EN post in Payload
        │
        │  (1) POST /api/internal/pipeline/translation-request
        ▼
Windmill flow  `f/localize-post`
        │  (2) for each target locale: LiteLLM chat completion
        │      (same CMS record → title, excerpt, seo, tags, blocks)
        ▼
        │  (3) POST /api/internal/translations   (same CMS, bearer token)
        ▼
translation rows land in posts_locales (hi/kn/…)
        │
        │  (4) POST tenant build hook (api.netlify.com) once ALL locales are in
        ▼
tenant site rebuilds with every language live
```

## Why a dedicated endpoint instead of the Local API

A localized `payload.update` on an already-published document is a no-op on this
Payload build: the localized values are merged and then written back under the
same locale. Translations written that way return success and vanish. The
intake endpoint writes the `posts_locales` / `posts_tags` rows directly — that
is the write translation actually needs — and never touches `en`.

## Contract: `POST /api/internal/translations`

Header: `Authorization: Bearer $PAYLOAD_PIPELINE_TOKEN` (unset ⇒ route 503s).

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

Rules enforced server-side:

- `locale` must be a translation target (`hi, kn, gu, ta, te, ml`); `en` is
  refused — the source language is never machine-written.
- The post must already exist **in that tenant**; the endpoint never creates posts.
- `seoTitle` ≤ 70, `seoDescription` ≤ 165 (the same limits the CMS field applies),
  so a machine translation cannot silently produce an unindexable page.
- Only `p` / `h2` / `ul` blocks are accepted — no HTML, no uploads, no links
  injected by the model.
- Max 25 posts per call, 200 blocks per post, 20 tags per post.
- Idempotent: identical content reports `"action": "unchanged"` and writes nothing.

## Contract: `POST /api/internal/pipeline/translation-request`

Called by Payload's `afterChange` hook when a post is published in the default
locale. It does not translate — it asks Windmill to. Returns `202` when the flow
was accepted, and the reason when it could not be (`not_configured`,
`no_target_locales`, `refresh_throttled`).

## The gate: build only after every locale lands

The tenant build hook fires from the Windmill flow's last step, not from the
publish event, so a site never rebuilds half-translated. Each tenant site must
also declare how many locales it serves (Zamindarr: `en`, `hi`, `kn`, with
`baseline: { en: 5, hi: 5, kn: 5 }` in `src/lib/content/config.ts`) — the static
adapter then fails the build on an empty locale instead of shipping a blank page.

## Operating notes

- Secrets live in Windmill resources, never in the flow script: the pipeline
  token, the LiteLLM key, and the per-tenant Netlify build-hook URLs.
- `windmill.xsama.org` sits behind Cloudflare Access. An inbound webhook needs a
  bypass policy scoped to the one trigger path; without it the request 302s to
  the Access login and never runs.
- Windmill CE has no AI/LLM action built in: call LiteLLM over HTTP from a plain
  `bun`/`python` script. That is also what keeps the pipeline provider-neutral.
