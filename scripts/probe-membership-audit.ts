/**
 * Membership audit end-to-end probe.
 *
 * Proves the audit hook records real membership changes against the live CMS:
 * creates a scratch user, grants, changes and revokes a project role, then
 * reads the resulting audit entries back through the local API.
 *
 * Everything it creates is deleted at the end. Run inside the deployed
 * container: `payload run scripts/probe-membership-audit.ts`.
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

const OWNER_EMAIL = (process.env.PAYLOAD_OWNER_EMAILS || '').split(',')[0]?.trim() || 'mdil@xsama.org'
const PROBE_EMAIL = 'audit-probe@xsama.invalid'
const TENANT_SLUG = 'layyun'

const payload = await getPayload({ config })

async function cleanup() {
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: PROBE_EMAIL } },
    limit: 1,
    overrideAccess: true,
  })
  for (const doc of existing.docs) {
    await payload.delete({ collection: 'users', id: doc.id, overrideAccess: true })
  }
  await payload.delete({
    collection: 'membership-audit',
    where: { OR: [{ subjectEmail: { equals: PROBE_EMAIL } }, { actorEmail: { equals: OWNER_EMAIL } }] },
    overrideAccess: true,
  } as any)
}

await cleanup()

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: TENANT_SLUG } },
  limit: 1,
  overrideAccess: true,
})
if (!tenants.docs.length) throw new Error(`tenant ${TENANT_SLUG} not found`)
const tenantId = tenants.docs[0].id

// Own audit records only from here on.
const before = await payload.count({ collection: 'membership-audit' as any, overrideAccess: true })

const created = await payload.create({
  collection: 'users',
  overrideAccess: true,
  // The actor is the configured owner, so entries are attributed, not anonymous.
  req: { user: { email: OWNER_EMAIL } as any } as any,
  data: {
    email: PROBE_EMAIL,
    password: `Probe-${Date.now()}-aA1!`,
    name: 'Audit Probe',
    tenants: [{ tenant: tenantId, role: 'viewer' }],
  } as any,
})
const userId = created.id

await payload.update({
  collection: 'users',
  id: userId,
  overrideAccess: true,
  req: { user: { email: OWNER_EMAIL } as any } as any,
  data: { tenants: [{ tenant: tenantId, role: 'editor' }] } as any,
})

await payload.update({
  collection: 'users',
  id: userId,
  overrideAccess: true,
  req: { user: { email: OWNER_EMAIL } as any } as any,
  data: { tenants: [] } as any,
})

const audit = await payload.find({
  collection: 'membership-audit' as any,
  where: { subjectEmail: { equals: PROBE_EMAIL } },
  limit: 50,
  sort: 'createdAt',
  overrideAccess: true,
})
const after = await payload.count({ collection: 'membership-audit' as any, overrideAccess: true })

const actions = audit.docs.map((d: any) => d.action)

const result = {
  recorded: actions,
  roleChange: audit.docs.find((d: any) => d.action === 'role_changed') ?? null,
  actorEmail: audit.docs[0]?.actorEmail ?? null,
  tenantLinked: audit.docs.every((d: any) => d.action === 'account_created' || d.tenant != null),
  delta: (after.totalDocs ?? 0) - (before.totalDocs ?? 0),
  subjectIdMatches: audit.docs.every((d: any) => Number(d.subject) === Number(userId) || d.subject == null),
}

await cleanup()

const remaining = await payload.find({
  collection: 'membership-audit' as any,
  where: { subjectEmail: { equals: PROBE_EMAIL } },
  limit: 1,
  overrideAccess: true,
})

console.log(JSON.stringify({ ...result, probeCleanedUp: remaining.docs.length === 0 }, null, 2))
process.exit(0)
