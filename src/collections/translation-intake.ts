/**
 * Translation intake endpoint — `POST /api/internal/translations`.
 *
 * Machine-to-machine seam for the localization pipeline (Windmill → LiteLLM →
 * here). It is deliberately narrow: it can ONLY write localized editorial values
 * onto posts that already exist, and only for tenants the caller is authorised
 * for. It cannot create, publish, unpublish, reparent or delete anything, and it
 * never touches the default language.
 *
 * Why an endpoint instead of the Local API: a localized `payload.update` on a
 * published document is a no-op on this Payload build (the localized values are
 * merged and then written back under the same locale), so translations written
 * that way silently vanish. This endpoint writes the `*_locales` rows directly,
 * which is the operation translation actually needs.
 *
 * Auth: `Authorization: Bearer <PAYLOAD_PIPELINE_TOKEN>` (shared secret, compare
 * with `timingSafeEqual`) plus a caller-supplied `tenant` slug. Without the env
 * var the route 503s rather than running open.
 *
 * Body:
 *   { "tenant": "zamindarr",
 *     "posts": [ { "slug": "...", "locale": "hi",
 *                  "title": "...", "excerpt": "...", "seoTitle": "...",
 *                  "seoDescription": "...", "tags": ["..."],
 *                  "blocks": [ {"p":"..."}, {"h2":"..."}, {"ul":["..."]} ] } ] }
 *
 * Response: per-post `{ slug, locale, action: "created"|"updated"|"unchanged" }`.
 * Idempotent — re-running with identical content reports `unchanged`.
 */
import { timingSafeEqual } from 'crypto'

import { sql } from '@payloadcms/db-postgres'
import type { PayloadHandler } from 'payload'

import { isBlogSection } from './content-contract'

const MAX_POSTS_PER_CALL = 25
const MAX_BLOCKS_PER_POST = 200
const MAX_TEXT = 20_000
const SUPPORTED_LOCALES = new Set(['hi', 'kn', 'gu', 'ta', 'te', 'ml'])

type Block = { p: string } | { h2: string } | { ul: string[] }
type IncomingPost = {
  slug?: unknown
  locale?: unknown
  title?: unknown
  excerpt?: unknown
  seoTitle?: unknown
  seoDescription?: unknown
  tags?: unknown
  blocks?: unknown
}

function tokensMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

const text = (t: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text: t,
  type: 'text',
  version: 1,
})

function toLexical(blocks: Block[]) {
  const node = (children: unknown[], extra: Record<string, unknown>) => ({
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
    ...extra,
  })
  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: blocks.map((block) =>
        'p' in block
          ? node([text(block.p)], { type: 'paragraph', textFormat: 0, textStyle: '' })
          : 'h2' in block
            ? node([text(block.h2)], { type: 'heading', tag: 'h2' })
            : node(
                block.ul.map((item) => ({ children: [text(item)], type: 'listitem', version: 1 })),
                { type: 'list', listType: 'bullet', start: 1, tag: 'ul' },
              ),
      ),
    },
  }
}

function validationError(message: string): Error {
  const error = new Error(message) as Error & { status?: number }
  error.status = 422
  return error
}

function parseBlocks(value: unknown): Block[] {
  if (!Array.isArray(value) || value.length === 0) throw validationError('blocks must be a non-empty array')
  if (value.length > MAX_BLOCKS_PER_POST) throw validationError(`blocks exceeds ${MAX_BLOCKS_PER_POST}`)
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw validationError(`blocks[${index}] must be an object`)
    const entry = raw as Record<string, unknown>
    if (typeof entry.p === 'string') {
      if (!entry.p.trim() || entry.p.length > MAX_TEXT) throw validationError(`blocks[${index}].p invalid`)
      return { p: entry.p }
    }
    if (typeof entry.h2 === 'string') {
      if (!entry.h2.trim() || entry.h2.length > 300) throw validationError(`blocks[${index}].h2 invalid`)
      return { h2: entry.h2 }
    }
    if (Array.isArray(entry.ul)) {
      if (!entry.ul.length || entry.ul.length > 50) throw validationError(`blocks[${index}].ul size invalid`)
      for (const item of entry.ul) {
        if (typeof item !== 'string' || !item.trim() || item.length > MAX_TEXT) {
          throw validationError(`blocks[${index}].ul item invalid`)
        }
      }
      return { ul: entry.ul as string[] }
    }
    throw validationError(`blocks[${index}] must be {p}, {h2} or {ul}`)
  })
}

function requiredString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw validationError(`${field} is required`)
  if (value.length > max) throw validationError(`${field} exceeds ${max} characters`)
  return value
}

export const translationsHandler: PayloadHandler = async (req) => {
  const expected = process.env.PAYLOAD_PIPELINE_TOKEN
  if (!expected) {
    return Response.json({ error: 'Translation intake is not configured' }, { status: 503 })
  }

  const header = req.headers.get('authorization') || ''
  const provided = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!provided || !tokensMatch(expected, provided)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { tenant?: unknown; posts?: unknown }
  try {
    body = (await req.json?.()) ?? {}
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const tenantSlug = typeof body.tenant === 'string' ? body.tenant.trim() : ''
  if (!tenantSlug) return Response.json({ error: 'tenant is required' }, { status: 422 })

  const incoming = body.posts
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return Response.json({ error: 'posts must be a non-empty array' }, { status: 422 })
  }
  if (incoming.length > MAX_POSTS_PER_CALL) {
    return Response.json({ error: `At most ${MAX_POSTS_PER_CALL} posts per call` }, { status: 422 })
  }

  const { payload } = req
  const tenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: tenantSlug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const tenant = tenants.docs[0]
  if (!tenant) return Response.json({ error: `Unknown tenant "${tenantSlug}"` }, { status: 404 })

  const db: any = (payload as any).db
  const results: Record<string, unknown>[] = []

  try {
    for (const raw of incoming as IncomingPost[]) {
      const slug = requiredString(raw.slug, 'slug', 200)
      const locale = requiredString(raw.locale, 'locale', 8)
      if (!SUPPORTED_LOCALES.has(locale)) {
        throw validationError(`locale "${locale}" is not a supported translation target`)
      }
      if (locale === 'en') throw validationError('English is the source language and cannot be written here')

      const found = await payload.find({
        collection: 'posts',
        where: { AND: [{ slug: { equals: slug } }, { tenant: { equals: tenant.id } }] },
        limit: 1,
        depth: 0,
        draft: true,
        overrideAccess: true,
      })
      const post = found.docs[0] as any
      if (!post) throw validationError(`Post "${slug}" does not exist in ${tenantSlug}`)
      if (post.section && !isBlogSection(post.section)) {
        throw validationError(`Post "${slug}" has an unsupported section`)
      }

      const title = requiredString(raw.title, 'title', 300)
      const excerpt = requiredString(raw.excerpt, 'excerpt', 400)
      const seoTitle = requiredString(raw.seoTitle, 'seoTitle', 70)
      const seoDescription = requiredString(raw.seoDescription, 'seoDescription', 165)
      const blocks = parseBlocks(raw.blocks)
      const tags = Array.isArray(raw.tags)
        ? raw.tags.map((tag, index) => requiredString(tag, `tags[${index}]`, 60))
        : []
      if (tags.length > 20) throw validationError('tags exceeds 20 entries')

      const content = JSON.stringify(toLexical(blocks))
      const existing = await db.execute({
        drizzle: db.drizzle,
        sql: sql`SELECT title, excerpt, seo_title, seo_description, content::text AS content
                 FROM posts_locales WHERE _parent_id = ${post.id} AND _locale = ${locale} LIMIT 1`,
      })
      const current = existing.rows?.[0]
      const unchanged =
        current &&
        current.title === title &&
        current.excerpt === excerpt &&
        current.seo_title === seoTitle &&
        current.seo_description === seoDescription &&
        JSON.stringify(JSON.parse(current.content ?? 'null')) === JSON.stringify(JSON.parse(content))

      if (!unchanged) {
        await db.execute({
          drizzle: db.drizzle,
          sql: sql`
            INSERT INTO posts_locales (_locale, _parent_id, title, excerpt, content, seo_title, seo_description)
            VALUES (${locale}, ${post.id}, ${title}, ${excerpt}, ${content}::jsonb, ${seoTitle}, ${seoDescription})
            ON CONFLICT (_locale, _parent_id) DO UPDATE SET
              title = EXCLUDED.title,
              excerpt = EXCLUDED.excerpt,
              content = EXCLUDED.content,
              seo_title = EXCLUDED.seo_title,
              seo_description = EXCLUDED.seo_description
          `,
        })
        await db.execute({
          drizzle: db.drizzle,
          sql: sql`DELETE FROM posts_tags WHERE _parent_id = ${post.id} AND _locale = ${locale}`,
        })
        for (let index = 0; index < tags.length; index += 1) {
          await db.execute({
            drizzle: db.drizzle,
            sql: sql`INSERT INTO posts_tags (id, _order, _parent_id, _locale, name)
                     VALUES (${`${post.id}-${locale}-${index}`}, ${index}, ${post.id}, ${locale}, ${tags[index]})`,
          })
        }
      }

      results.push({
        slug,
        locale,
        action: current ? (unchanged ? 'unchanged' : 'updated') : 'created',
        postId: post.id,
      })
    }
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500
    payload.logger.error(`Translation intake failed for ${tenantSlug}: ${(error as Error).message}`)
    return Response.json(
      { error: (error as Error).message, completed: results },
      { status: status === 422 ? 422 : 500 },
    )
  }

  payload.logger.info(
    `Translation intake: ${results.length} locale write(s) for tenant ${tenantSlug}`,
  )
  return Response.json({ tenant: tenantSlug, tenantId: tenant.id, results })
}
