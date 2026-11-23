/**
 * Seed the first Dhanda blog article (English only) into the multi-tenant CMS.
 *
 * Run inside the production container (DATABASE_URL / PAYLOAD_SECRET present):
 *   node_modules/.bin/tsx scripts/seed-dhanda-post.ts
 *
 * Idempotent by tenant + slug. Dhanda is published English-only for now; the
 * per-locale completeness gate means the other seven locales stay empty and are
 * omitted from builds until translated. No cover image is attached (optional).
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

const TENANT_SLUG = 'dhanda'
const SLUG = 'setting-up-your-store-with-dhanda'
const OWNER_EMAIL = process.env.DHANDA_SEED_OWNER_EMAIL || process.env.PAYLOAD_OWNER_EMAILS?.split(',')[0]?.trim() || 'mdil@xsama.org'

// --- Minimal Lexical builders (no jsdom / HTML conversion dependency) ---------
const text = (t: string) => ({ detail: 0, format: 0, mode: 'normal', style: '', text: t, type: 'text', version: 1 })
const para = (t: string) => ({ children: [text(t)], direction: 'ltr', format: '', indent: 0, type: 'paragraph', version: 1, textFormat: 0, textStyle: '' })
const h2 = (t: string) => ({ children: [text(t)], direction: 'ltr', format: '', indent: 0, type: 'heading', version: 1, tag: 'h2' })
const bullet = (items: string[]) => ({
  children: items.map((t) => ({ children: [text(t)], direction: 'ltr', format: '', indent: 0, type: 'listitem', version: 1, value: 1 })),
  direction: 'ltr', format: '', indent: 0, type: 'list', version: 1, listType: 'bullet', start: 1, tag: 'ul',
})
const lexical = (children: any[]) => ({ root: { children, direction: 'ltr', format: '', indent: 0, type: 'root', version: 1 } })

const TITLE = 'Setting up your store: billing, inventory and procurement with Dhanda'
const EXCERPT =
  'A practical starting point for small and medium retail stores: build a clean product list, bill every sale consistently, and tie procurement to what you actually sell, so stock and cash stay in step.'
const SEO_TITLE = 'Setting up your store with Dhanda: billing & inventory'
const SEO_DESCRIPTION =
  'A practical guide for small and medium retail stores: clean product lists, consistent billing, and procurement tied to sales, using Dhanda.'

const content = lexical([
  para(
    'Dhanda is a simple, fast retail app for billing, inventory, procurement and sales, built for small and medium stores. This guide walks through a sensible order for setting up your store so that the day-to-day work — ringing up sales, knowing what is in stock, and deciding what to buy next — stays connected instead of living in separate notebooks and spreadsheets.',
  ),
  h2('Start with a clean product list'),
  para(
    'Inventory is the foundation everything else rests on. Before you bill your first sale, add the products you actually carry, with a clear name, a selling price, and the unit you sell by (piece, packet, kilogram, and so on). A tidy product list means faster billing, fewer pricing mistakes at the counter, and stock numbers you can trust.',
  ),
  bullet([
    'Use names your staff will recognise at the counter, not internal codes.',
    'Set the selling price once, so every bill uses the same number.',
    'Record the unit you sell by, so quantities and stock mean the same thing everywhere.',
    'Start with your fast-moving lines; you can add the long tail as you go.',
  ]),
  h2('Bill every sale, consistently'),
  para(
    'Billing is where inventory and sales meet. When every sale goes through the same flow, each bill automatically does two jobs: it gives the customer a clear record, and it updates what you have left in stock. Skipping bills — even for small or regular customers — is what quietly breaks stock accuracy, so make billing the default for every transaction.',
  ),
  h2('Tie procurement to what you sell'),
  para(
    'Procurement works best when it is driven by real sales rather than guesswork. Because Dhanda keeps billing, inventory and sales together, you can look at what is moving and what is running low before you place an order. Buy to replenish what customers are actually taking off the shelf, and avoid tying up cash in stock that sits.',
  ),
  h2('Review sales to plan your next purchase'),
  para(
    'A short, regular look at your sales tells you which lines earn their shelf space and which do not. Use that view to decide what to reorder, what to promote, and what to stop carrying. The goal is not a complicated report — it is a simple, repeatable check that keeps purchasing aligned with demand.',
  ),
  h2('A simple weekly routine'),
  bullet([
    'Add any new products and correct prices before the week gets busy.',
    'Bill every sale as it happens, so stock stays current.',
    'Check low-stock lines and place procurement orders against real demand.',
    'Glance at the week’s sales to plan the next order and spot slow movers.',
  ]),
  para(
    'Set up in this order — products first, then consistent billing, then procurement tied to sales — and the four parts of the app reinforce each other. That is the whole idea behind Dhanda: one connected place to run your store, instead of scattered records that never quite agree.',
  ),
])

const payload = await getPayload({ config })
const req = { user: { email: OWNER_EMAIL } } as any

const tenantResult = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: TENANT_SLUG } },
  limit: 1,
  overrideAccess: true,
})
const tenant = tenantResult.docs[0]
if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} does not exist`)

const existing = await payload.find({
  collection: 'posts',
  where: { AND: [{ slug: { equals: SLUG } }, { tenant: { equals: tenant.id } }] },
  limit: 1,
  draft: true,
  overrideAccess: true,
})

let document: any = existing.docs[0]
let action: 'created' | 'exists' = 'exists'
if (!document) {
  document = await payload.create({
    collection: 'posts',
    data: {
      title: TITLE,
      slug: SLUG,
      excerpt: EXCERPT,
      content,
      tags: ['billing', 'inventory', 'retail', 'getting started'].map((name) => ({ name })),
      tenant: tenant.id,
      section: 'guides',
      contentType: 'guide',
      publishedAt: new Date().toISOString(),
      authorship: { authorName: 'Dhanda' },
      seo: { title: SEO_TITLE, description: SEO_DESCRIPTION },
      _status: 'published',
    },
    locale: 'en',
    draft: false,
    overrideAccess: true,
    req,
  } as any)
  action = 'created'
}

console.log(JSON.stringify({ action, tenant: tenant.slug, id: document.id, slug: SLUG, section: 'guides', status: document._status, locale: 'en' }))
await payload.destroy()