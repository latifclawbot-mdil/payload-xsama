/**
 * Trigger endpoint — `POST /api/internal/pipeline/translation-request`.
 *
 * Two callers:
 *  1. Payload's posts `afterChange` hook, when an English article is published.
 *  2. An operator / replay job, with the pipeline bearer token, to re-run
 *     translations after a prompt change or a failed workflow run.
 *
 * It never translates inline: it hands the job to the workflow engine (Windmill)
 * and returns immediately, so publishing is not held hostage by a model call.
 */
import { timingSafeEqual } from 'crypto'

import type { PayloadHandler } from 'payload'

import { requestTranslation } from './translation-trigger'

function tokensMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export const translationRequestHandler: PayloadHandler = async (req) => {
  // Two ways in: the CMS-internal hook path (server-side call, no bearer) or an
  // operator replay (bearer token). Anything else is rejected.
  const internal = req.headers.get('x-cms-internal') === 'publish-hook'
  if (!internal) {
    const expected = process.env.PAYLOAD_PIPELINE_TOKEN
    if (!expected) return Response.json({ error: 'Pipeline is not configured' }, { status: 503 })
    const header = req.headers.get('authorization') || ''
    const provided = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
    if (!provided || !tokensMatch(expected, provided)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: { postId?: unknown; slug?: unknown; tenant?: unknown; reason?: unknown }
  try {
    body = (await req.json?.()) ?? {}
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const postId = body.postId
  if (typeof postId !== 'number' && typeof postId !== 'string') {
    return Response.json({ error: 'postId is required' }, { status: 422 })
  }

  const { payload } = req
  let post: any
  try {
    post = await payload.findByID({
      collection: 'posts',
      id: postId as any,
      depth: 0,
      draft: true,
      overrideAccess: true,
    })
  } catch {
    return Response.json({ error: `Post ${postId} not found` }, { status: 404 })
  }
  if (!post) return Response.json({ error: `Post ${postId} not found` }, { status: 404 })

  const outcome = await requestTranslation({
    payload,
    post,
    reason: body.reason === 'manual' ? 'manual' : 'published',
  })

  const status = outcome.status === 'accepted' ? 202 : outcome.status === 'skipped' && outcome.reason === 'not_configured' ? 503 : 200
  return Response.json({ postId: post.id, slug: post.slug, ...outcome }, { status })
}
