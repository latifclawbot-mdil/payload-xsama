/**
 * Executable check for the Windmill flow script.
 *
 * Mirrors what Windmill does (import `main`, call it) against a local fake of
 * LiteLLM, the Payload translation intake, and a Netlify build hook. The flow is
 * plain `fetch`, so Node runs it as-is after type stripping — no bun needed.
 *
 * Run: node --experimental-strip-types scripts/windmill/run-flow.check.ts
 */
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { main } = await import('./f_localize_post.ts')

type Call = { method: string; url: string; body: string }

const calls: Call[] = []
let llmCalls = 0
let failLocale: string | null = null

const article = {
  title: 'RERA 2025: Buyers First',
  excerpt: "New compliance rules are changing how Karnataka's real estate projects get registered.",
  blocks: [
    { p: 'Karnataka RERA has implemented comprehensive reforms in 2025.' },
    { h2: 'What changed' },
    { ul: ['Registration above 500 sq m', '70% escrow', 'Four-month complaint target'] },
  ],
}

const server = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    calls.push({ method: req.method ?? '', url: req.url ?? '', body })
    const send = (status: number, value: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(value))
    }

    if (req.url?.includes('/api/tenants')) return send(200, { docs: [{ slug: 'zamindarr' }] })
    if (req.url?.includes('/api/posts')) {
      return send(200, {
        docs: [
          {
            slug: 'rera-2025-buyers-first',
            title: article.title,
            excerpt: article.excerpt,
            content: {
              root: {
                children: [
                  { type: 'paragraph', children: [{ type: 'text', text: article.blocks[0].p }] },
                  { type: 'heading', children: [{ type: 'text', text: article.blocks[1].h2 }] },
                  {
                    type: 'list',
                    children: article.blocks[2].ul.map((item: string) => ({
                      type: 'listitem',
                      children: [{ type: 'text', text: item }],
                    })),
                  },
                ],
              },
            },
          },
        ],
      })
    }
    if (req.url?.endsWith('/v1/chat/completions')) {
      llmCalls += 1
      const parsed = JSON.parse(body) as { messages: { role: string; content: string }[] }
      const source = JSON.parse(parsed.messages[1].content) as typeof article
      const locale = body.includes('Kannada') ? 'kn' : 'hi'
      if (failLocale === locale) return send(500, { error: 'upstream failure' })
      return send(200, {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: `${locale}: ${source.title}`,
                excerpt: `${locale}: ${source.excerpt}`,
                seoTitle: `${locale}: RERA 2025`,
                seoDescription: `${locale}: ${source.excerpt}`,
                tags: ['rera', 'niyam'],
                blocks: [
                  { p: `${locale}: ${source.blocks[0].p}` },
                  { h2: `${locale}: ${source.blocks[1].h2}` },
                  { ul: source.blocks[2].ul.map((item: string) => `${locale}: ${item}`) },
                ],
              }),
            },
          },
        ],
      })
    }
    if (req.url?.includes('/api/internal/translations')) {
      const payload = JSON.parse(body) as { posts: { locale: string }[] }
      return send(200, {
        results: payload.posts.map((post) => ({ locale: post.locale, action: 'created' })),
      })
    }
    if (req.url === '/build-hook') return send(200, { ok: true })
    return send(404, { error: `unexpected ${req.url}` })
  })
})

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

const litellm = { base_url: base, api_key: 'test-key', model: 'test-model' }
const payloadResource = { base_url: base, pipeline_token: 'pipeline-token' }
const builds = { zamindarr: `${base}/build-hook` }

const failures: string[] = []
const expect = (condition: boolean, message: string) => {
  if (!condition) failures.push(message)
}

// --- Happy path: both locales land, then the build fires once.
const result = await main(
  {
    postId: 21,
    slug: 'rera-2025-buyers-first',
    tenant: 6,
    targetLocales: ['hi', 'kn'],
    idempotencyKey: 'abc',
  },
  litellm,
  payloadResource,
  builds,
)

const intakeCalls = calls.filter((call) => call.url.includes('/api/internal/translations'))
const buildCalls = calls.filter((call) => call.url === '/build-hook')
const written = intakeCalls.flatMap((call) => (JSON.parse(call.body) as any).posts)

expect(result.build === 'triggered', 'happy path should trigger the build')
expect(written.length === 2, `expected 2 translated documents, got ${written.length}`)
expect(written.every((post: any) => post.blocks.length === 3), 'block count must be preserved')
expect(written.every((post: any) => post.seoDescription.length <= 165), 'seoDescription must be clamped')
expect(written.every((post: any) => post.locale !== 'en'), 'English must never be written by the pipeline')
expect(buildCalls.length === 1, `build hook should fire exactly once, fired ${buildCalls.length}`)
// Order matters: the build must be the LAST thing that happens.
const lastCall = calls[calls.length - 1]
expect(lastCall.url === '/build-hook', 'build hook must be the final call')
expect(llmCalls === 2, `expected 2 model calls, got ${llmCalls}`)

// --- Failure path: a locale fails, so nothing is built.
calls.length = 0
failLocale = 'kn'
let failed = false
try {
  await main(
    { postId: 21, slug: 'rera-2025-buyers-first', tenant: 6, targetLocales: ['hi', 'kn'], idempotencyKey: 'def' },
    litellm,
    payloadResource,
    builds,
  )
} catch {
  failed = true
}
expect(failed, 'a failing locale must abort the flow')
expect(calls.filter((call) => call.url === '/build-hook').length === 0, 'no build when a translation fails')

// --- Gate path: intake accepts but reports a missing locale ⇒ still no build.
failLocale = null
calls.length = 0
server.removeAllListeners('request')
server.on('request', (req, res) => {
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    calls.push({ method: req.method ?? '', url: req.url ?? '', body })
    const send = (status: number, value: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(value))
    }
    if (req.url?.includes('/api/tenants')) return send(200, { docs: [{ slug: 'zamindarr' }] })
    if (req.url?.includes('/api/posts')) {
      return send(200, {
        docs: [
          {
            slug: 'x',
            title: 't',
            excerpt: 'e',
            content: { root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: 'body' }] }] } },
          },
        ],
      })
    }
    if (req.url?.endsWith('/v1/chat/completions')) {
      const locale = body.includes('Kannada') ? 'kn' : 'hi'
      return send(200, {
        choices: [{ message: { content: JSON.stringify({ title: 't', excerpt: 'e', seoTitle: 't', seoDescription: 'e', tags: [], blocks: [{ p: 'body' }] }) } }],
      })
    }
    if (req.url?.includes('/api/internal/translations')) {
      // Deliberately drop the Kannada write, as a partial-write bug would.
      return send(200, { results: [{ locale: 'hi', action: 'created' }] })
    }
    if (req.url === '/build-hook') return send(200, { ok: true })
    return send(404, { error: 'unexpected' })
  })
})

let gateHeld = false
try {
  await main(
    { postId: 1, slug: 'x', tenant: 6, targetLocales: ['hi', 'kn'], idempotencyKey: 'ghi' },
    litellm,
    payloadResource,
    builds,
  )
} catch (error) {
  gateHeld = String((error as Error).message).includes('missing kn')
}
expect(gateHeld, 'flow must refuse to build when a locale did not land')
expect(calls.filter((call) => call.url === '/build-hook').length === 0, 'no build when a locale is missing')

server.close()

if (failures.length) {
  console.error(`FAIL (${failures.length})`)
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log('PASS — translate → intake → gate → build, with abort on failure and on a missing locale')
