/**
 * Import the existing Advista journal into the multi-tenant Payload CMS.
 *
 * Run inside the production container with the journal mounted at
 * ADVISTA_CONTENT_DIR. The operation is idempotent by tenant + slug.
 *
 * IMPORT_STATUS=draft  (default) imports without publishing
 * IMPORT_STATUS=published        matches the legacy site's public state
 */
import { convertHTMLToLexical, sanitizeServerEditorConfig } from '@payloadcms/richtext-lexical'
import fs from 'node:fs'
import path from 'node:path'
// @ts-expect-error jsdom does not ship TypeScript declarations
import { JSDOM } from 'jsdom'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const LOCALES = ['en', 'ar', 'de', 'es', 'fil', 'fr', 'hi', 'it', 'ja', 'ko', 'fa', 'pt', 'ru', 'tr', 'ur', 'zh'] as const
const TENANT_SLUG = 'advista'
const contentDir = process.env.ADVISTA_CONTENT_DIR || '/app/content-import/blog'
const logoPath = process.env.ADVISTA_LOGO_PATH || '/app/content-import/logo.png'
const status = process.env.IMPORT_STATUS === 'published' ? 'published' : 'draft'

type LegacyPost = {
  slug: string
  lang: string
  title: string
  date: string
  tags?: string[]
  excerpt: string
  content: string
}

function readJournal() {
  const journal = new Map<string, Map<string, LegacyPost>>()
  for (const locale of LOCALES) {
    const dir = path.join(contentDir, locale)
    if (!fs.existsSync(dir)) throw new Error(`Missing locale directory: ${dir}`)
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
      const post = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as LegacyPost
      if (!post.slug || !post.title || !post.content || !post.date) {
        throw new Error(`Incomplete legacy post ${locale}/${file}`)
      }
      if (!journal.has(post.slug)) journal.set(post.slug, new Map())
      journal.get(post.slug)!.set(locale, post)
    }
  }
  for (const [slug, byLocale] of journal) {
    const missing = LOCALES.filter((locale) => !byLocale.has(locale))
    if (missing.length) throw new Error(`Post ${slug} is missing locales: ${missing.join(', ')}`)
  }
  return journal
}

const payload = await getPayload({ config })
const rawEditor = (payload.config as any).editor
if (!rawEditor) throw new Error('Payload editor configuration is unavailable')
const editorConfig = await sanitizeServerEditorConfig(rawEditor, payload.config as any, true)
// Payload's Local API bypasses access control but still runs beforeChange hooks.
// Supply the configured global owner so the tenant-role guard applies correctly.
const req = { user: { email: process.env.ADVISTA_IMPORT_OWNER_EMAIL || 'mdil@xsama.org' } } as any

const tenantResult = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: TENANT_SLUG } },
  limit: 1,
  overrideAccess: true,
})
const tenant = tenantResult.docs[0]
if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} does not exist`)

let mediaId: number | string | undefined
const existingMedia = await payload.find({
  collection: 'media',
  where: { AND: [{ filename: { equals: 'logo.png' } }, { tenant: { equals: tenant.id } }] },
  limit: 1,
  overrideAccess: true,
})
if (existingMedia.docs[0]) {
  mediaId = existingMedia.docs[0].id
} else {
  if (!fs.existsSync(logoPath)) throw new Error(`Cover image not found: ${logoPath}`)
  const media = await payload.create({
    collection: 'media',
    data: { alt: 'Advista logo', tenant: tenant.id },
    filePath: logoPath,
    overrideAccess: true,
    req,
  })
  mediaId = media.id
}

const journal = readJournal()
let created = 0
let updated = 0
let localized = 0

for (const [slug, byLocale] of [...journal.entries()].sort()) {
  const english = byLocale.get('en')!
  const existing = await payload.find({
    collection: 'posts',
    where: { AND: [{ slug: { equals: slug } }, { tenant: { equals: tenant.id } }] },
    limit: 1,
    draft: true,
    overrideAccess: true,
  })
  let document = existing.docs[0]
  if (document) {
    updated += 1
  } else {
    document = await payload.create({
      collection: 'posts',
      data: {
        title: english.title,
        slug,
        excerpt: english.excerpt,
        content: convertHTMLToLexical({ editorConfig, html: english.content, JSDOM }),
        coverImage: mediaId,
        tags: english.tags?.map((name) => ({ name })) ?? [],
        publishedAt: new Date(`${english.date}T00:00:00.000Z`).toISOString(),
        tenant: tenant.id,
        _status: status,
      },
      locale: 'en',
      draft: status !== 'published',
      overrideAccess: true,
      req,
    })
    created += 1
  }

  for (const locale of LOCALES) {
    const post = byLocale.get(locale)!
    await payload.update({
      collection: 'posts',
      id: document.id,
      locale,
      draft: false,
      overrideAccess: true,
      req,
      data: {
        title: post.title,
        excerpt: post.excerpt,
        content: convertHTMLToLexical({ editorConfig, html: post.content, JSDOM }),
        tags: post.tags?.map((name) => ({ name })) ?? [],
        _status: status,
      },
    })
    localized += 1
  }
}

console.log(JSON.stringify({
  status,
  tenant: tenant.slug,
  slugs: [...journal.keys()].sort(),
  created,
  updated,
  localized,
  mediaId,
}))

await payload.destroy()
