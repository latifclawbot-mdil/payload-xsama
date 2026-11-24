/**
 * Migrate Zamindarr's four legacy hardcoded blog articles (old branch
 * src/data/blogArticles.ts) into the multi-tenant CMS, tenant `zamindarr`.
 *
 * Content is copied VERBATIM from the legacy articles (split on blank lines into
 * paragraphs) — no paraphrasing, no invented facts. Upserts by tenant + slug so a
 * re-run repairs any earlier drifted copy. Published English-only (other locales
 * stay empty and are omitted from builds until translated). No cover image.
 *
 * Run inside the production container (DATABASE_URL / PAYLOAD_SECRET present):
 *   node_modules/.bin/tsx scripts/seed-zamindarr-posts.ts
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

// Verbatim from old branch src/data/blogArticles.ts (content split on "\n\n").
const ARTICLES: Legacy[] = [
  {
    slug: 'digital-revolution-or-documentation-nightmare',
    title: 'Digital Revolution or Documentation Nightmare?',
    section: 'guides',
    contentType: 'guide',
    excerpt: "E-Khata's Mandatory Implementation Transforms Bangalore Property Transactions",
    publishedAt: '2024-01-15',
    tags: ['e-khata', 'documentation', 'market trends'],
    paragraphs: [
      "The digitization of property records through E-Khata represents a watershed moment in Bangalore's real estate administration. Since its mandatory implementation on September 30, 2024, property owners and developers have been navigating a fundamentally transformed documentation landscape.",
      'Effective July 1, 2025, BBMP has integrated E-Khata submission as a prerequisite for all online building plan approvals through the EoDB-OBPS platform. This integration streamlines verification processes while creating new compliance requirements that demand careful attention from all stakeholders.',
      'For property buyers, the E-Khata system offers unprecedented transparency into ownership records, tax payment history, and property dimensions. However, the transition has not been without challenges—many older properties require extensive documentation updates before achieving compliance.',
      'Industry experts recommend initiating E-Khata verification early in any property transaction to avoid delays during registration and loan processing stages.',
    ],
  },
  {
    slug: 'premium-far-revolution',
    title: 'Premium FAR Revolution',
    section: 'regulations',
    contentType: 'article',
    excerpt: "Karnataka's New Policy Redefines Bangalore's Skyline and Investment Strategy",
    publishedAt: '2024-01-10',
    tags: ['far', 'policy', 'bangalore'],
    paragraphs: [
      "The Premium Floor Area Ratio scheme, introduced by BBMP in April 2025, fundamentally alters development economics across Bangalore's prime corridors. Under this framework, property owners and developers can acquire additional FAR to construct taller structures in designated zones.",
      'Eligibility is determined by road width and locality classification, with the premium capped at 40% above base limits. The calculation methodology ties premium costs to property guidance values, ensuring transparent and predictable pricing mechanisms for all stakeholders.',
      'Rooted in recent amendments to the Karnataka Town and Country Planning Act, this initiative generates significant revenue for urban infrastructure development. However, it substantially impacts project feasibility assessments and property valuations in affected areas.',
      'Investors should carefully evaluate Premium FAR implications before acquiring properties in eligible zones, as the additional construction potential may significantly enhance—or complicate—development strategies depending on site-specific factors.',
    ],
  },
  {
    slug: 'rera-2025-buyers-first',
    title: 'RERA 2025: Buyers First',
    section: 'regulations',
    contentType: 'article',
    excerpt: "New Compliance Rules Transform Karnataka's Real Estate Project Registration",
    publishedAt: '2024-01-05',
    tags: ['rera', 'regulations', 'buyer rights'],
    paragraphs: [
      "Karnataka's Real Estate Regulatory Authority has implemented comprehensive reforms in 2025, establishing stringent standards for project registration, developer disclosure, and financial accountability across the state.",
      'All developments exceeding 500 square meters now require mandatory registration, with developers obligated to deposit 70% of buyer funds in designated escrow accounts. Annual audit reports must be filed with the authority, creating unprecedented financial transparency in the sector.',
      'The enhanced penalty framework addresses defaults and misrepresentation more effectively than previous regulations. Complaint resolution processes have been streamlined with target turnaround times of four months, significantly reducing buyer grievance timelines.',
      'These measures strengthen buyer protection mechanisms considerably while establishing complete transparency in developer performance tracking through the online portal. Prospective buyers are advised to verify RERA registration status and review developer compliance history before any property commitment.',
    ],
  },
  {
    slug: 'due-diligence-checklist-avoiding-property-investment-pitfalls',
    title: 'Due Diligence Checklist: Avoiding Property Investment Pitfalls',
    section: 'guides',
    contentType: 'guide',
    excerpt: 'A comprehensive framework for thorough verification before making any property investment decision in Bangalore.',
    publishedAt: '2023-12-28',
    tags: ['due diligence', 'checklist', 'investment'],
    paragraphs: [
      'Rigorous due diligence forms the foundation of sound property investment strategy. This systematic approach encompasses verification of ownership documentation, encumbrance certificate analysis, zoning regulation compliance, and assessment of developer credentials.',
      'Title chain examination remains the most critical verification step. Ensure continuous ownership records spanning at least 30 years, with particular attention to inheritance transfers, partition deeds, and court settlements that may create future claims.',
      'Encumbrance certificates should be obtained for the maximum available period, with careful review of any registered mortgages, liens, or pending litigation. RERA registration verification confirms project legitimacy and provides access to approved plans and financial disclosures.',
      "Beyond documentation, physical verification of property boundaries, existing constructions, and access roads prevents disputes post-purchase. Engaging qualified professionals for legal opinion and technical assessment significantly reduces investment risk in Bangalore's complex real estate environment.",
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
  const data = {
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
  }
  const existing = await payload.find({
    collection: 'posts',
    where: { AND: [{ slug: { equals: a.slug } }, { tenant: { equals: tenant.id } }] },
    limit: 1,
    draft: true,
    overrideAccess: true,
  })
  let document: any
  let action: 'created' | 'updated'
  if (existing.docs[0]) {
    document = await payload.update({
      collection: 'posts',
      id: existing.docs[0].id,
      data,
      locale: 'en',
      draft: false,
      overrideAccess: true,
      req,
    } as any)
    action = 'updated'
  } else {
    document = await payload.create({ collection: 'posts', data, locale: 'en', draft: false, overrideAccess: true, req } as any)
    action = 'created'
  }
  results.push({ action, id: document.id, slug: a.slug, section: a.section, status: document._status })
}

console.log(JSON.stringify({ tenant: tenant.slug, tenantId: tenant.id, results }, null, 2))
await payload.destroy()
process.exit(0)
