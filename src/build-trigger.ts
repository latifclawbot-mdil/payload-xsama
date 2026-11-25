import { tenantIdOf } from './access'
import { requestTranslation } from './collections/translation-trigger'

/**
 * Per-tenant static rebuild trigger.
 *
 * Editorial changes request one build per project through that project's
 * configured host hook. The outcome is written back onto the project's site
 * settings so a failed deploy is visible in the CMS instead of only in logs.
 */

const recentBuilds = new Map<string, number>()
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
const pendingChanges = new Map<string, { req: any; doc?: any; previousDoc?: any }>()
const BUILD_DEBOUNCE_MS = 60_000

type SiteSettingsDoc = {
  id: string | number
  buildHookUrl?: string | null
}

function allowedHosts(): string[] {
  return (process.env.BUILD_HOOK_ALLOWED_HOSTS || 'api.netlify.com')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
}

async function recordOutcome(
  payload: any,
  settingsId: string | number,
  status: 'delivered' | 'failed' | 'unconfigured',
  error?: string,
  req?: any,
) {
  try {
    await payload.update({
      collection: 'site-settings',
      id: settingsId,
      data: {
        lastBuildStatus: status,
        lastBuildRequestedAt: new Date().toISOString(),
        ...(error ? { lastBuildError: error.slice(0, 500) } : {}),
      },
      overrideAccess: true,
      // Reuse the originating request so tenant guards evaluate the real actor.
      ...(req ? { req } : {}),
    })
  } catch (writeError) {
    payload.logger.warn(
      `Could not record build status for site settings ${settingsId}: ${(writeError as Error).message}`,
    )
  }
}

/**
 * Request a rebuild for the tenant that owns a changed document.
 * Safe to call on every afterChange/afterDelete; debouncing is per tenant.
 */
export async function requestTenantRebuild({
  req,
  doc,
  previousDoc,
  force = false,
}: {
  req: any
  doc?: any
  previousDoc?: any
  force?: boolean
}): Promise<void> {
  const tenantId = tenantIdOf(doc?.tenant ?? previousDoc?.tenant)
  if (tenantId == null) return

  const key = String(tenantId)
  const now = Date.now()
  const elapsed = now - (recentBuilds.get(key) ?? 0)
  if (!force && elapsed < BUILD_DEBOUNCE_MS) {
    // Inside the debounce window: coalesce this change into ONE trailing rebuild
    // at the window's end. Without this, a late edit (e.g. at +59s) was silently
    // dropped and would not publish until the next unrelated change.
    pendingChanges.set(key, { req, doc, previousDoc })
    if (!pendingTimers.has(key)) {
      const timer = setTimeout(() => {
        pendingTimers.delete(key)
        const change = pendingChanges.get(key)
        pendingChanges.delete(key)
        // Use a minimal req carrying the stable payload instance: the originating
        // request's transaction may be closed by the time the trailing fire runs.
        if (change) void requestTenantRebuild({ ...change, force: true, req: { payload: change.req.payload } })
      }, BUILD_DEBOUNCE_MS - elapsed)
      if (typeof timer.unref === 'function') timer.unref()
      pendingTimers.set(key, timer)
    }
    return
  }

  const settings = await req.payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const record = settings.docs[0] as SiteSettingsDoc | undefined
  if (!record) {
    req.payload.logger.warn(`No site settings for tenant ${key}; skipping rebuild`)
    return
  }

  const hook = record.buildHookUrl?.trim()
  if (!hook) {
    // Nothing to call, but record the state so the gap is visible in the admin.
    await recordOutcome(req.payload, record.id, 'unconfigured', undefined, req)
    return
  }

  let url: URL
  try {
    url = new URL(hook)
  } catch {
    await recordOutcome(req.payload, record.id, 'failed', 'Invalid build hook URL', req)
    return
  }
  if (url.protocol !== 'https:' || !allowedHosts().includes(url.hostname.toLowerCase())) {
    await recordOutcome(
      req.payload,
      record.id,
      'failed',
      `Refused host ${url.hostname}: not in BUILD_HOOK_ALLOWED_HOSTS`,
      req,
    )
    return
  }

  recentBuilds.set(key, now)
  try {
    const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await recordOutcome(req.payload, record.id, 'delivered', undefined, req)
    req.payload.logger.info(`Requested rebuild for tenant ${key}`)
  } catch (error) {
    recentBuilds.delete(key)
    await recordOutcome(req.payload, record.id, 'failed', (error as Error).message, req)
    req.payload.logger.error(`Rebuild request failed for tenant ${key}: ${(error as Error).message}`)
  }
}

/** Hook wrapper: rebuild whenever a document enters or leaves publication. */
export async function requestRebuildOnPublish({ doc, previousDoc, req }: any) {
  const wasPublished = previousDoc?._status === 'published'
  const isPublished = doc?._status === 'published'
  if (!wasPublished && !isPublished) return
  await requestTenantRebuild({ req, doc, previousDoc })
}

/**
 * Publish hook: ask the localization pipeline to translate.
 *
 * Deliberately does NOT trigger the tenant rebuild — the rebuild is the last step
 * of the translation flow, so a site never publishes an article whose other
 * languages are still missing. A non-English publish means a pipeline write
 * landed; the flow owns the build in that case.
 */
export async function requestTranslationOnPublish({ doc, previousDoc, req }: any) {
  const newlyPublished = doc?._status === 'published' && previousDoc?._status !== 'published'
  if (!newlyPublished) return
  try {
    await requestTranslation({ payload: req.payload, post: doc, reason: 'published' })
  } catch (error) {
    // Never let a workflow outage fail an editorial publish.
    req.payload?.logger?.warn?.(`Translation trigger error for post ${doc?.id}: ${(error as Error).message}`)
  }
}

/** Hook wrapper: rebuild after a deletion so removed content leaves the site. */
export async function requestRebuildOnDelete({ doc, req }: any) {
  await requestTenantRebuild({ req, doc: undefined, previousDoc: doc })
}

/** Test seam: clear the debounce window and any pending trailing rebuilds. */
export function resetRebuildDebounce() {
  recentBuilds.clear()
  for (const timer of pendingTimers.values()) clearTimeout(timer)
  pendingTimers.clear()
  pendingChanges.clear()
}
