import type { CollectionConfig, Field } from 'payload'

/**
 * URL sections available under a site's unified `/blog` root.
 * The section is part of the canonical URL, so it is fixed after publish.
 */
export const BLOG_SECTIONS = [
  ['insights', 'Insights'],
  ['guides', 'Guides'],
  ['work', 'Work / case studies'],
  ['regulations', 'Regulations'],
  ['journal', 'Journal'],
] as const

const sectionOptions = BLOG_SECTIONS.map(([value, label]) => ({ label, value }))

/** Fields every published item needs to produce a complete, indexable page. */
export const seoFields: Field[] = [
  {
    name: 'section',
    type: 'select',
    required: true,
    defaultValue: 'insights',
    index: true,
    options: sectionOptions,
    admin: {
      description: 'Canonical URL section under /blog. Changing it after publish breaks existing links.',
      position: 'sidebar',
    },
    validate: (_value: unknown, { siblingData }: any) =>
      siblingData?._status === 'published' || Boolean(_value)
        ? true
        : 'A published item needs a section so it has one canonical URL.',
  },
  {
    name: 'seo',
    type: 'group',
    label: 'SEO',
    fields: [
      { name: 'title', type: 'text', localized: true, maxLength: 70, admin: { description: 'Overrides the page title. Aim for 50–60 characters.' } },
      { name: 'description', type: 'textarea', localized: true, maxLength: 165, admin: { description: 'Meta description. Aim for 120–155 characters.' } },
      { name: 'keywords', type: 'array', localized: true, fields: [{ name: 'term', type: 'text', required: true }] },
      { name: 'canonicalOverride', type: 'text' },
      { name: 'noindex', type: 'checkbox', defaultValue: false },
      { name: 'breadcrumbLabel', type: 'text', localized: true, admin: { description: 'Short label for breadcrumbs; falls back to the title.' } },
    ],
  },
  {
    name: 'authorship',
    type: 'group',
    label: 'Authorship',
    fields: [
      { name: 'authorName', type: 'text', localized: true },
      { name: 'authorUrl', type: 'text' },
      { name: 'reviewerName', type: 'text', localized: true, admin: { description: 'Named reviewer for regulatory, compliance, or property claims.' } },
      { name: 'reviewedAt', type: 'date' },
    ],
  },
  {
    name: 'citations',
    type: 'array',
    fields: [
      { name: 'title', type: 'text', required: true },
      { name: 'url', type: 'text', required: true },
      { name: 'publisher', type: 'text' },
      { name: 'accessedAt', type: 'date' },
    ],
  },
]

/** Optional structured-data blocks. Only publish when the visible content supports them. */
export const richResultFields: Field[] = [
  {
    name: 'faq',
    type: 'array',
    admin: { description: 'Emit FAQPage schema only for questions answered verbatim on the page.' },
    fields: [
      { name: 'question', type: 'text', required: true, localized: true },
      { name: 'answer', type: 'textarea', required: true, localized: true },
    ],
  },
  {
    name: 'howToSteps',
    type: 'array',
    admin: { description: 'Emit HowTo schema only for genuine ordered instructions.' },
    fields: [
      { name: 'name', type: 'text', required: true, localized: true },
      { name: 'text', type: 'textarea', required: true, localized: true },
    ],
  },
]

/** Per-locale publication gate: a locale is omitted from builds unless it is complete. */
export async function validateLocalizedCompleteness({ req, data, originalDoc }: any) {
  if (data?._status !== 'published') return data
  const locale = req?.locale
  if (!locale || locale === 'all') return data
  const merged = { ...(originalDoc ?? {}), ...(data ?? {}) }
  const problems: string[] = []
  if (!merged.title) problems.push('title')
  if (!merged.excerpt) problems.push('excerpt')
  if (!merged.content) problems.push('body')
  if (!merged.seo?.title) problems.push('SEO title')
  if (!merged.seo?.description) problems.push('SEO description')
  if (problems.length) {
    const error = new Error(`Cannot publish locale "${locale}": missing ${problems.join(', ')}.`)
    ;(error as any).status = 422
    throw error
  }
  return data
}
