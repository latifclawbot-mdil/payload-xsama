// Windmill flow script — localize a published CMS post and rebuild the tenant site.
//
// Windmill: script language `bun` (or `deno`), runs in a worker. Configure the
// resources named below in the Windmill workspace; nothing secret lives here.
//
//   litellm   → { base_url, api_key, model }         user runs the LiteLLM gateway
//   payload   → { base_url, pipeline_token }         the multi-tenant CMS
//   builds    → { "<tenant-slug>": "<netlify build hook url>", ... }
//
// Trigger: Payload POSTs { postId, slug, tenant, targetLocales, idempotencyKey }
// to this flow's webhook (see docs/translation-pipeline.md).
//
// Contract with the CMS (POST {cms}/api/internal/translations):
//   { tenant, posts: [{ slug, locale, title, excerpt, seoTitle, seoDescription,
//                       tags, blocks: [{p}|{h2}|{ul:[...]}] }] }
//
// The build hook fires ONLY after every requested locale has been written, which
// is the whole point: a tenant site never rebuilds half-translated.

type Block = { p: string } | { h2: string } | { ul: string[] }

type PostInput = {
  postId: number | string
  slug: string
  tenant: string | number
  targetLocales: string[]
  idempotencyKey: string
}

type Resource = { base_url: string; api_key: string; model?: string }
type PayloadResource = { base_url: string; pipeline_token: string }

const LOCALE_NAMES: Record<string, string> = {
  hi: 'Hindi',
  kn: 'Kannada',
  gu: 'Gujarati',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
}

const SEO_DESCRIPTION_MAX = 165
const SEO_TITLE_MAX = 70
const CONCURRENCY = 3

export async function main(
  post: PostInput,
  litellm: Resource,
  payload: PayloadResource,
  builds: Record<string, string>,
) {
  if (!post?.slug) throw new Error('post.slug is required')
  const tenantSlug = await resolveTenantSlug(post.tenant, payload)
  const source = await fetchSourceArticle(post.slug, tenantSlug, payload)
  if (!source.blocks.length) throw new Error(`Post ${post.slug} has no English body to translate`)

  const buildHook = builds?.[tenantSlug]
  if (!buildHook) throw new Error(`No build hook configured for tenant "${tenantSlug}"`)

  const written: { locale: string; action: string }[] = []
  for (const batch of chunk(post.targetLocales, CONCURRENCY)) {
    const translated = await Promise.all(
      batch.map((locale) => translateArticle({ locale, source, litellm })),
    )
    const response = await fetch(`${payload.base_url}/api/internal/translations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${payload.pipeline_token}`,
      },
      body: JSON.stringify({ tenant: tenantSlug, posts: translated }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Translation intake rejected ${batch.join(',')}: ${response.status} ${detail.slice(0, 300)}`)
    }
    const result = (await response.json()) as { results: { locale: string; action: string }[] }
    written.push(...result.results)
  }

  // Gate: rebuild only when every requested locale landed.
  const landed = new Set(written.map((entry) => entry.locale))
  const missing = post.targetLocales.filter((locale) => !landed.has(locale))
  if (missing.length) {
    throw new Error(`Translations incomplete for ${post.slug}: missing ${missing.join(', ')} — build NOT triggered`)
  }

  const buildResponse = await fetch(buildHook, { method: 'POST', body: '' })
  if (!buildResponse.ok) {
    throw new Error(`Build hook for ${tenantSlug} returned ${buildResponse.status}`)
  }

  return { tenant: tenantSlug, slug: post.slug, written, build: 'triggered' }
}

/** Accept an id or a slug — the flow is called both from Payload and by hand. */
async function resolveTenantSlug(tenant: string | number, payload: PayloadResource): Promise<string> {
  if (typeof tenant === 'string' && Number.isNaN(Number(tenant))) return tenant
  const query = `where[id][equals]=${encodeURIComponent(String(tenant))}&limit=1&depth=0`
  const response = await fetch(`${payload.base_url}/api/tenants?${query}`, {
    headers: { authorization: `Bearer ${payload.pipeline_token}` },
  })
  if (!response.ok) throw new Error(`Could not resolve tenant ${tenant}: ${response.status}`)
  const data = (await response.json()) as { docs?: { slug: string }[] }
  const slug = data.docs?.[0]?.slug
  if (!slug) throw new Error(`Tenant ${tenant} not found`)
  return slug
}

/** Read the English source straight from the public API — it is published content. */
async function fetchSourceArticle(
  slug: string,
  tenantSlug: string,
  payload: PayloadResource,
): Promise<{ title: string; excerpt: string; blocks: Block[] }> {
  const query =
    `where[slug][equals]=${encodeURIComponent(slug)}` +
    `&where[_status][equals]=published&locale=en&fallback-locale=none&depth=0&limit=1`
  const response = await fetch(`${payload.base_url}/api/posts?${query}`)
  if (!response.ok) throw new Error(`Could not read post ${slug}: ${response.status}`)
  const data = (await response.json()) as { docs?: any[] }
  const doc = data.docs?.[0]
  if (!doc) throw new Error(`Published post ${slug} not found in ${tenantSlug}`)

  return {
    title: String(doc.title ?? ''),
    excerpt: String(doc.excerpt ?? ''),
    blocks: lexicalToBlocks(doc.content),
  }
}

/** Lexical → the pipeline's neutral block shape. Unsupported nodes are dropped,
 *  never guessed: a model must not be handed something it can mangle. */
function lexicalToBlocks(content: any): Block[] {
  const children = content?.root?.children
  if (!Array.isArray(children)) return []
  const blocks: Block[] = []
  for (const node of children) {
    if (node?.type === 'paragraph') {
      const text = nodeText(node)
      if (text) blocks.push({ p: text })
    } else if (node?.type === 'heading') {
      const text = nodeText(node)
      if (text) blocks.push({ h2: text })
    } else if (node?.type === 'list') {
      const items = (node.children ?? [])
        .map((item: any) => nodeText(item))
        .filter((item: string) => item.length > 0)
      if (items.length) blocks.push({ ul: items })
    }
  }
  return blocks
}

function nodeText(node: any): string {
  if (!node) return ''
  if (node.type === 'text') return String(node.text ?? '')
  return (node.children ?? []).map(nodeText).join('').trim()
}

/**
 * One translation. The model gets the whole article (not paragraph-by-paragraph,
 * which loses the argument between paragraphs) and must answer with JSON only.
 */
async function translateArticle({
  locale,
  source,
  litellm,
}: {
  locale: string
  source: { title: string; excerpt: string; blocks: Block[] }
  litellm: Resource
}): Promise<{
  slug?: string
  locale: string
  title: string
  excerpt: string
  seoTitle: string
  seoDescription: string
  tags: string[]
  blocks: Block[]
}> {
  const language = LOCALE_NAMES[locale] ?? locale
  const payloadForModel = {
    title: source.title,
    excerpt: source.excerpt,
    blocks: source.blocks.map((block) =>
      'ul' in block ? { ul: block.ul } : 'h2' in block ? { h2: block.h2 } : { p: block.p },
    ),
  }

  const system = [
    `You translate property and land-record articles from English into ${language}.`,
    'Rules:',
    '- Translate faithfully. Never add facts, figures, dates, prices, or claims that are not in the source.',
    '- Keep scheme names, authority names, statute names and identifiers in Latin script',
    '  (e.g. E-Khata, BBMP, BDA, DTCP, EoDB-OBPS, RERA, FAR, EC, OC).',
    '- Keep the block structure identical: same number of blocks, same order, same kinds',
    '  ("p" paragraph, "h2" heading, "ul" bullet list). Never merge or split blocks.',
    '- Numbers, units and dates stay numerically identical; only the surrounding prose is translated.',
    '- seoTitle must be at most ${SEO_TITLE_MAX} characters; seoDescription at most ${SEO_DESCRIPTION_MAX}.',
    '- tags: return the same number of tags, translated (identifiers stay in Latin script).',
    '- Output valid JSON only, no commentary, matching:',
    '  {"title":"...","excerpt":"...","seoTitle":"...","seoDescription":"...","tags":["..."],"blocks":[{"p":"..."}|{"h2":"..."}|{"ul":["..."]}]}',
  ].join('\n')

  const response = await fetch(`${litellm.base_url.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${litellm.api_key}`,
    },
    body: JSON.stringify({
      model: litellm.model || 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(payloadForModel) },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(`LiteLLM ${response.status} translating ${locale}: ${(await response.text()).slice(0, 200)}`)
  }
  const completion = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  const raw = completion.choices?.[0]?.message?.content
  if (!raw) throw new Error(`Empty completion for ${locale}`)

  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Model returned non-JSON for ${locale}`)
  }

  const blocks = validateBlocks(parsed.blocks, source.blocks.length, locale)
  const title = requireString(parsed.title, 'title', 300, locale)
  const excerpt = requireString(parsed.excerpt, 'excerpt', 400, locale)
  const seoTitle = clamp(requireString(parsed.seoTitle || parsed.title, 'seoTitle', 400, locale), SEO_TITLE_MAX)
  const seoDescription = clamp(
    requireString(parsed.seoDescription || parsed.excerpt, 'seoDescription', 600, locale),
    SEO_DESCRIPTION_MAX,
  )
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.slice(0, 20).map((tag: unknown) => String(tag).trim()).filter(Boolean)
    : []

  return {
    locale,
    title,
    excerpt,
    seoTitle,
    seoDescription,
    tags,
    blocks,
  }
}

function validateBlocks(value: unknown, expected: number, locale: string): Block[] {
  if (!Array.isArray(value) || value.length !== expected) {
    throw new Error(`Block count mismatch for ${locale}: got ${Array.isArray(value) ? value.length : 'none'}, expected ${expected}`)
  }
  return value.map((block, index) => {
    if (block && typeof block.p === 'string' && block.p.trim()) return { p: block.p }
    if (block && typeof block.h2 === 'string' && block.h2.trim()) return { h2: block.h2 }
    if (block && Array.isArray(block.ul) && block.ul.length) return { ul: block.ul.map(String) }
    throw new Error(`Block ${index} for ${locale} has an unsupported shape`)
  })
}

function requireString(value: unknown, field: string, max: number, locale: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(`Missing ${field} for ${locale}`)
  return clamp(text, max)
}

function clamp(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size))
  return out
}
