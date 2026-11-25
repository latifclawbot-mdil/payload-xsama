/**
 * Write the `hi` / `kn` values for Zamindarr's posts by patching the locale rows
 * directly.
 *
 * Why not `payload.update`? On this Payload build a localized Local API update
 * merges against the "current doc" and writes the merged document back with
 * `locale` — the seeded translations kept vanishing while the call returned
 * success. Writing the `posts_locales` rows is the operation the translations
 * actually need: English stays byte-identical and no other document is touched.
 *
 * Idempotent: upserts each locale row and replaces its tag rows.
 *
 * Run inside the production container (uses DATABASE_URL):
 *   node_modules/.bin/tsx scripts/seed-zamindarr-translations.ts
 */
import { createRequire } from 'node:module'

import { getPayload } from 'payload'
import config from '../src/payload.config'
import { TRANSLATIONS } from './zamindarr-translations.data'

const TENANT_SLUG = 'zamindarr'

const text = (t: string) => ({ detail: 0, format: 0, mode: 'normal', style: '', text: t, type: 'text', version: 1 })
const block = (children: any[], extra: Record<string, any> = {}) => ({
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
})
const toLexical = (blocks: any[]) => ({
  root: {
    children: blocks.map((b: any) =>
      'p' in b
        ? block([text(b.p)], { type: 'paragraph', textFormat: 0, textStyle: '' })
        : 'h2' in b
          ? block([text(b.h2)], { type: 'heading', tag: 'h2' })
          : block(
              b.ul.map((item: string) => ({ children: [text(item)], type: 'listitem', version: 1 })),
              { type: 'list', listType: 'bullet', start: 1, tag: 'ul' },
            ),
    ),
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

const payload = await getPayload({ config })
const db: any = (payload as any).db
// pnpm leaves drizzle-orm unhoisted, so resolve it through Payload's own copy
// rather than a hard-coded container path (this file must build anywhere).
// @ts-expect-error drizzle-orm is a transitive dep (unhoisted by pnpm); it is
// resolved at runtime through Payload's own copy.
const { sql } = await import('drizzle-orm').catch(async () => {
  const resolved = createRequire(import.meta.url).resolve('payload')
  const root = resolved.slice(0, resolved.indexOf('/node_modules/payload/') + '/node_modules'.length)
  return import(`${root}/drizzle-orm/index.js`)
})

const tenantResult = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: TENANT_SLUG } },
  limit: 1,
  overrideAccess: true,
})
const tenant = tenantResult.docs[0]
if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} does not exist`)

const results: any[] = []
for (const [slug, byLocale] of Object.entries(TRANSLATIONS)) {
  const found: any = await payload.find({
    collection: 'posts',
    where: { AND: [{ slug: { equals: slug } }, { tenant: { equals: tenant.id } }] },
    limit: 1,
    draft: true,
    overrideAccess: true,
  })
  const doc = found.docs[0]
  if (!doc) throw new Error(`Post ${slug} does not exist in tenant ${TENANT_SLUG}`)

  for (const locale of ['hi', 'kn'] as const) {
    const t: any = byLocale[locale]
    if (t.seoDescription.length > 165) {
      throw new Error(`${slug}/${locale} seo.description is ${t.seoDescription.length} chars (max 165)`)
    }
    const content = JSON.stringify(toLexical(t.blocks))
    await db.execute({
      drizzle: db.drizzle,
      sql: sql`
        INSERT INTO posts_locales (_locale, _parent_id, title, excerpt, content, seo_title, seo_description)
        VALUES (${locale}, ${doc.id}, ${t.title}, ${t.excerpt}, ${content}::jsonb, ${t.seoTitle.slice(0, 70)}, ${t.seoDescription})
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
      sql: sql`DELETE FROM posts_tags WHERE _parent_id = ${doc.id} AND _locale = ${locale}`,
    })
    for (let i = 0; i < t.tags.length; i += 1) {
      await db.execute({
        drizzle: db.drizzle,
        sql: sql`INSERT INTO posts_tags (id, _order, _parent_id, _locale, name)
                 VALUES (${`${doc.id}-${locale}-${i}`}, ${i}, ${doc.id}, ${locale}, ${t.tags[i]})`,
      })
    }
    results.push({ id: doc.id, slug, locale, title: t.title, blocks: t.blocks.length })
  }
}

// Read the written rows back through SQL so a silent no-op cannot pass.
const check = await db.execute({
  drizzle: db.drizzle,
  sql: sql`SELECT _parent_id, _locale, left(title, 24) AS title, jsonb_array_length(content->'root'->'children') AS blocks
           FROM posts_locales WHERE _locale IN ('hi','kn') AND _parent_id = ANY(ARRAY[15,19,20,21,22]) ORDER BY _parent_id, _locale`,
})
console.log(JSON.stringify({ tenant: tenant.slug, tenantId: tenant.id, results, written: check.rows }, null, 2))
await payload.destroy()
process.exit(0)
