/**
 * Translation trigger — `POST /api/internal/pipeline/translation-request`.
 *
 * Payload calls this from the posts `afterChange` hook when an English article is
 * published. It does not translate anything itself: it asks the Windmill flow
 * `f/localize-post` to run, and Windmill then drives LiteLLM → the translation
 * intake endpoint → the tenant build hook. The CMS stays the source of truth and
 * the workflow engine stays swappable.
 *
 * Guard rails:
 *  - No-op unless `WM_TRANSLATION_WEBHOOK` (or `WM_FLOW_WEBHOOK`) is configured,
 *    so an unconfigured environment never fires stray traffic.
 *  - Idempotency key is derived from post id + updatedAt, so a re-save that does
 *    not change the body cannot trigger a second paid translation run.
 *  - Errors are swallowed with a log line: a translation outage must never make
 *    publishing an article fail.
 */
import { createHmac } from 'crypto'

import type { Payload } from 'payload'

const TRIGGER_TIMEOUT_MS = 8_000

type TriggerReason = 'published' | 'manual'

export type TranslationRequestOutcome =
  | { status: 'accepted'; reason: TriggerReason }
  | { status: 'skipped'; reason: 'not_configured' | 'not_published' | 'not_english' | 'no_target_locales' | 'refresh_throttled' | 'already_running' }

/** Locales the pipeline is allowed to write. Must match translation-intake.ts. */
export const TRANSLATION_TARGETS = ['hi', 'kn', 'gu', 'ta', 'te', 'ml'] as const

function webhookUrl(): string {
  return (process.env.WM_TRANSLATION_WEBHOOK || process.env.WM_FLOW_WEBHOOK || '').trim()
}

/** Only ever post to the configured URL — never to a document-supplied host. */
function isAllowedHost(url: string): boolean {
  try {
    const parsed = new URL(url)
    const allowed = (process.env.WM_ALLOWED_HOSTS || '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
    if (!allowed.length) return false
    return allowed.includes(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

/**
 * Deterministic idempotency key: same post revision ⇒ same key, so Windmill (or
 * the CMS) can drop a duplicate request instead of paying for the same
 * translation twice.
 */
export function translationIdempotencyKey(postId: string | number, revision: string): string {
  return createHmac('sha256', process.env.PAYLOAD_SECRET || 'translation')
    .update(`${postId}:${revision}`)
    .digest('hex')
    .slice(0, 32)
}

export async function requestTranslation({
  payload,
  post,
  reason = 'published',
}: {
  payload: Payload
  post: {
    id: string | number
    slug?: string | null
    tenant?: unknown
    _status?: unknown
    updatedAt?: string | null
    title?: string | null
  }
  reason?: TriggerReason
}): Promise<TranslationRequestOutcome> {
  const url = webhookUrl()
  if (!url || !isAllowedHost(url)) return { status: 'skipped', reason: 'not_configured' }

  // Publishing only. A draft or an unpublished document has nothing to translate.
  const status = post._status
  const isPublished =
    status === 'published' ||
    (typeof status === 'object' &&
      status !== null &&
      Object.values(status as Record<string, unknown>).includes('published'))
  if (!isPublished) return { status: 'skipped', reason: 'not_published' }
  if (!post.slug) return { status: 'skipped', reason: 'not_published' }

  const payloadBody = {
    postId: post.id,
    slug: post.slug,
    tenant: post.tenant,
    title: post.title ?? null,
    sourceLocale: 'en',
    targetLocales: [...TRANSLATION_TARGETS],
    idempotencyKey: translationIdempotencyKey(post.id, post.updatedAt ?? String(post.id)),
    reason,
  }

  if (!payloadBody.targetLocales.length) return { status: 'skipped', reason: 'no_target_locales' }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.WM_API_TOKEN ? { authorization: `Bearer ${process.env.WM_API_TOKEN}` } : {}),
      },
      body: JSON.stringify(payloadBody),
      signal: AbortSignal.timeout(TRIGGER_TIMEOUT_MS),
    })
    if (response.status === 429) return { status: 'skipped', reason: 'refresh_throttled' }
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      payload.logger.warn(
        `Translation trigger rejected (${response.status}) for post ${post.id}: ${text.slice(0, 200)}`,
      )
      return { status: 'skipped', reason: 'not_configured' }
    }
    payload.logger.info(
      `Translation requested for post ${post.id} (${payloadBody.slug}) → ${payloadBody.targetLocales.join(', ')}`,
    )
    return { status: 'accepted', reason }
  } catch (error) {
    // A workflow outage must never fail publishing.
    payload.logger.warn(
      `Translation trigger failed for post ${post.id}: ${(error as Error).message}`,
    )
    return { status: 'skipped', reason: 'not_configured' }
  }
}
