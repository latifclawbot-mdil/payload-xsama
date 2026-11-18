import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestTenantRebuild, resetRebuildDebounce } from '@/build-trigger'

const originalEnv = { ...process.env }

function fakePayload({ hook }: { hook?: string | null }) {
  const updates: any[] = []
  return {
    updates,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    find: vi.fn(async () => ({ docs: [{ id: 'settings-1', buildHookUrl: hook }] })),
    update: vi.fn(async (args: any) => {
      updates.push(args)
      return args
    }),
  }
}

const reqFor = (payload: any) => ({ payload }) as any

describe('tenant rebuild trigger', () => {
  beforeEach(() => {
    process.env.BUILD_HOOK_ALLOWED_HOSTS = 'api.netlify.com'
    resetRebuildDebounce()
    vi.restoreAllMocks()
  })
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('records an unconfigured hook without making a request', async () => {
    const payload = fakePayload({ hook: null })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await requestTenantRebuild({ req: reqFor(payload), doc: { tenant: 1 } })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(payload.updates.at(-1).data.lastBuildStatus).toBe('unconfigured')
  })

  it('refuses a hook on a host outside the allowlist', async () => {
    const payload = fakePayload({ hook: 'https://evil.example.com/hook' })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await requestTenantRebuild({ req: reqFor(payload), doc: { tenant: 1 } })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(payload.updates.at(-1).data.lastBuildStatus).toBe('failed')
  })

  it('requests an allowed build and records delivery', async () => {
    const payload = fakePayload({ hook: 'https://api.netlify.com/build_hooks/abc' })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }))
    await requestTenantRebuild({ req: reqFor(payload), doc: { tenant: 1 } })
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(payload.updates.at(-1).data.lastBuildStatus).toBe('delivered')
  })

  it('records a failed request', async () => {
    const payload = fakePayload({ hook: 'https://api.netlify.com/build_hooks/abc' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 502 }))
    await requestTenantRebuild({ req: reqFor(payload), doc: { tenant: 1 } })
    expect(payload.updates.at(-1).data.lastBuildStatus).toBe('failed')
    expect(payload.updates.at(-1).data.lastBuildError).toContain('502')
  })

  it('debounces repeated requests for the same project', async () => {
    const payload = fakePayload({ hook: 'https://api.netlify.com/build_hooks/abc' })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }))
    const req = reqFor(payload)
    await requestTenantRebuild({ req, doc: { tenant: 1 } })
    await requestTenantRebuild({ req, doc: { tenant: 1 } })
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('does not rebuild when no tenant is present', async () => {
    const payload = fakePayload({ hook: 'https://api.netlify.com/build_hooks/abc' })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await requestTenantRebuild({ req: reqFor(payload), doc: {} })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(payload.find).not.toHaveBeenCalled()
  })
})
