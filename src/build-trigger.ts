import { tenantIdOf } from './access'

/**
 * Per-tenant static rebuild trigger.
 *
 * Editorial changes request one build per project through that project's
 * configured host hook. The outcome is written back onto the project's site
 * settings so a failed deploy is visible in the CMS instead of only in logs.
 */

const recentBuilds = new Map<string, number>()
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
  if (!force && now - (recentBuilds.get(key) ?? 0) < BUILD_DEBOUNCE_MS) return

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
    await recordOutcome(req.payload, record.id, 'unconfigured')
    return
  }

  let url: URL
  try {
    url = new URL(hook)
  } catch {
    await recordOutcome(req.payload, record.id, 'failed', 'Invalid build hook URL')
    return
  }
  if (url.protocol !== 'https:' || !allowedHosts().includes(url.hostname.toLowerCase())) {
    await recordOutcome(
      req.payload,
      record.id,
      'failed',
      `Refused host ${url.hostname}: not in BUILD_HOOK_ALLOWED_HOSTS`,
    )
    return
  }

  recentBuilds.set(key, now)
  try {
    const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await recordOutcome(req.payload, record.id, 'delivered')
    req.payload.logger.info(`Requested rebuild for tenant ${key}`)
  } catch (error) {
    recentBuilds.delete(key)
    await recordOutcome(req.payload, record.id, 'failed', (error as Error).message)
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

/** Hook wrapper: rebuild after a deletion so removed content leaves the site. */
export async function requestRebuildOnDelete({ doc, req }: any) {
  await requestTenantRebuild({ req, doc: undefined, previousDoc: doc })
}

/** Test seam: clear the debounce window. */
export function resetRebuildDebounce() {
  recentBuilds.clear()
}
