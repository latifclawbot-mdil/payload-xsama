/**
 * Migrate Zamindarr's four legacy hardcoded blog articles (old branch
 * src/data/blogArticles.ts) into the multi-tenant CMS, tenant `zamindarr`.
 *
 * Run inside the production container (DATABASE_URL / PAYLOAD_SECRET present):
 *   node_modules/.bin/tsx scripts/seed-zamindarr-posts.ts
 *
 * Idempotent by tenant + slug. Published English-only (other locales stay empty
 * and are omitted from builds until translated). No cover image is attached
 * (optional); the legacy /lovable-uploads art can be added later via Media.
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

const TENANT_SLUG = 'zamindarr'
const OWNER_EMAIL = process.env.PAYLOAD_OWNER_EMAILS?.split(',')[0]?.trim() || 'mdil@xsama.org'

const text = (t: string) => ({ detail: 0, format: 0, mode: 'normal', style: '', text: t, type: 'text', version: 1 })
const para = (t: string) => ({ children: [text(t)], direction: 'ltr', format: '', indent: 0, type: 'paragraph', version: 1, textFormat: 0, textStyle: '' })
const lexical = (children: any[]) => ({ root: { children, direction: 'ltr', format: '', indent: 0, type: 'root', version: 1 } })

type Legacy = {
  slug: string
  title: string
  section: 'guides' | 'regulations'
  contentType: 'guide' | 'article'
  excerpt: string
  publishedAt: string
  tags: string[]
  paragraphs: string[]
}

const ARTICLES: Legacy[] = [
  {
    slug: 'digital-revolution-or-documentation-nightmare',
    title: 'Digital Revolution or Documentation Nightmare?',
    section: 'guides',
    contentType: 'guide',
    excerpt: "Karnataka's Bhoomi RTC went digital in November 2025, but only 80% of records are available online. The rest? Still paper.",
    publishedAt: '2024-01-15',
    tags: ['documentation', 'bhoomi', 'kaveri', 'due diligence'],
    paragraphs: [
      "The state's ambitious digitization drive has hit a wall. While urban properties transition smoothly to online systems, rural land records remain trapped in bureaucratic limbo.",
      "Buyers now face a dual system: digital records for some properties, physical files for others. This creates confusion and delays in property transactions.",
      "The Kaveri 2.0 portal promises seamless integration, but ground reality shows stark differences between districts. Bangalore Urban leads with 95% digitization, while rural districts lag at 60%.",
      "Property buyers must now verify both digital and physical records, doubling their due diligence efforts. The promise of a paperless future remains just that—a promise.",
    ],
  },
  {
    slug: 'premium-far-revolution',
    title: 'Premium FAR Revolution',
    section: 'regulations',
    contentType: 'article',
    excerpt: 'Karnataka doubles FAR to 2.4 for premium plots, but infrastructure costs make developers hesitant.',
    publishedAt: '2024-01-10',
    tags: ['far', 'policy', 'bangalore', 'development'],
    paragraphs: [
      'The new policy allows Floor Area Ratio of 2.4 for plots on roads wider than 12 meters, up from the previous 1.2. This theoretically doubles construction potential.',
      'However, developers must pay premium charges and contribute to infrastructure development. The additional costs range from ₹500-1500 per sq ft depending on location.',
      "Early adopters in Whitefield and Electronic City report mixed results. While some projects benefit from increased density, others struggle with the financial burden.",
      'The policy aims to create more housing supply, but market response suggests it may primarily benefit luxury developments rather than affordable housing.',
    ],
  },
  {
    slug: 'rera-2025-buyers-first',
    title: 'RERA 2025: Buyers First',
    section: 'regulations',
    contentType: 'article',
    excerpt: 'New RERA amendments give buyers unprecedented power to cancel bookings and claim full refunds.',
    publishedAt: '2024-01-05',
    tags: ['rera', 'regulations', 'buyer rights'],
    paragraphs: [
      'The Karnataka RERA has introduced sweeping changes that tilt the balance decisively toward property buyers. Developers now face stricter penalties for project delays.',
      "Buyers can cancel bookings without penalty if projects are delayed by more than 6 months. Full refund including interest must be processed within 45 days.",
      'The new rules also mandate quarterly project updates and escrow account transparency. Developers must maintain 70% of buyer funds in dedicated project accounts.',
      'Industry experts predict this will clean up the market but may increase property prices as developers factor in compliance costs and reduced cash flow flexibility.',
    ],
  },
  {
    slug: 'due-diligence-checklist-avoiding-property-investment-pitfalls',
    title: 'Due Diligence Checklist: Avoiding Property Investment Pitfalls',
    section: 'guides',
    contentType: 'guide',
    excerpt: 'Comprehensive guide to verifying property documents and avoiding common investment mistakes in Bangalore real estate.',
    publishedAt: '2023-12-28',
    tags: ['due diligence', 'checklist', 'investment'],
    paragraphs: [
      'Property investment in Bangalore requires thorough verification of multiple documents. Missing even one critical document can lead to legal complications years later.',
      'Start with the title deed and trace ownership history for at least 30 years. Verify encumbrance certificates, property tax receipts, and approved building plans.',
      'Check for RERA registration if buying from developers. Verify carpet area calculations and understand the difference between super built-up and actual usable area.',
      'Engage qualified legal professionals for document verification. The cost of proper due diligence is minimal compared to potential losses from defective titles.',
    ],
  },
]

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

const results: any[] = []
for (const a of ARTICLES) {
  const existing = await payload.find({
    collection: 'posts',
    where: { AND: [{ slug: { equals: a.slug } }, { tenant: { equals: tenant.id } }] },
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
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        content: lexical(a.paragraphs.map(para)),
        tags: a.tags.map((name) => ({ name })),
        tenant: tenant.id,
        section: a.section,
        contentType: a.contentType,
        publishedAt: new Date(a.publishedAt).toISOString(),
        authorship: { authorName: 'Zamindarr' },
        seo: { title: a.title.slice(0, 70), description: a.excerpt.slice(0, 165) },
        _status: 'published',
      },
      locale: 'en',
      draft: false,
      overrideAccess: true,
      req,
    } as any)
    action = 'created'
  }
  results.push({ action, id: document.id, slug: a.slug, section: a.section, status: document._status })
}

console.log(JSON.stringify({ tenant: tenant.slug, tenantId: tenant.id, results }, null, 2))
await payload.destroy()