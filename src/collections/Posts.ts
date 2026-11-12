import type { CollectionConfig } from 'payload'
import { editorialRead, enforceTenantRole, isGlobalOwner, tenantIdOf, tenantWriteAccess } from '../access'

const write = tenantWriteAccess('posts')
const recentBuilds = new Map<string, number>()
const BUILD_DEBOUNCE_MS = 60_000

async function triggerPublishedBuild({ doc, previousDoc, req }: any) {
  const wasPublished = previousDoc?._status === 'published'
  const isPublished = doc?._status === 'published'
  if (!wasPublished && !isPublished) return
  const tenantId = tenantIdOf(doc?.tenant ?? previousDoc?.tenant)
  if (tenantId == null) return

  const key = String(tenantId)
  const now = Date.now()
  if (now - (recentBuilds.get(key) ?? 0) < BUILD_DEBOUNCE_MS) return

  const settings = await req.payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const hook = settings.docs[0]?.buildHookUrl?.trim()
  if (!hook) return

  let url: URL
  try {
    url = new URL(hook)
  } catch {
    req.payload.logger.error(`Invalid build hook URL for tenant ${key}`)
    return
  }
  const allowedHosts = (process.env.BUILD_HOOK_ALLOWED_HOSTS || 'api.netlify.com')
    .split(',').map((host) => host.trim().toLowerCase()).filter(Boolean)
  if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname.toLowerCase())) {
    req.payload.logger.error(`Refused build hook for tenant ${key}: ${url.hostname} is not allowed`)
    return
  }

  recentBuilds.set(key, now)
  try {
    const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    req.payload.logger.info(`Triggered build for tenant ${key}`)
  } catch (error) {
    recentBuilds.delete(key)
    req.payload.logger.error(`Build trigger failed for tenant ${key}: ${(error as Error).message}`)
  }
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'tenant', 'publishedAt', '_status', 'updatedAt'] },
  versions: { drafts: true, maxPerDoc: 100 },
  access: {
    read: editorialRead(true),
    create: write.create,
    update: write.update,
    delete: write.delete,
  },
  hooks: {
    beforeChange: [enforceTenantRole()],
    afterChange: [triggerPublishedBuild],
    afterDelete: [triggerPublishedBuild],
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'slug', type: 'text', required: true, index: true },
    { name: 'excerpt', type: 'textarea', required: true, localized: true, maxLength: 400 },
    { name: 'content', type: 'richText', required: true, localized: true },
    { name: 'coverImage', type: 'upload', relationTo: 'media' },
    {
      name: 'tags',
      type: 'array',
      localized: true,
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    { name: 'publishedAt', type: 'date', required: true, index: true },
    {
      name: 'authorName',
      type: 'text',
      localized: true,
      admin: { description: 'Named author whose work is being published; leave blank for an institutional byline.' },
    },
  ],
}
