import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

/**
 * Membership audit writer.
 *
 * Converts the difference between the previous and submitted `tenants` array
 * into explicit audit entries. Kept separate from the access rules in
 * `membership.ts`: those decide what may change, this records what did.
 *
 * Design notes:
 *  - Only membership deltas are recorded. A profile-only save produces no noise.
 *  - Audit writes use `overrideAccess` (the collection denies all API writes)
 *    and never throw into the caller: failing to record must not fail a save
 *    that already succeeded, but it is logged loudly.
 *  - The actor is the authenticated request user; system flows carry the
 *    configured owner identity, so no entry is ever anonymous.
 */

type Row = { tenant?: unknown; role?: string }
type Actor = { id?: string | number; email?: string | null } | null

const idOf = (value: unknown): string | number | null => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'object' && 'id' in (value as object)) {
    const id = (value as { id?: string | number }).id
    return typeof id === 'string' || typeof id === 'number' ? id : null
  }
  return null
}

const rowsOf = (doc: any): Row[] => (Array.isArray(doc?.tenants) ? doc.tenants : [])

type Entry = {
  action: 'member_added' | 'member_removed' | 'role_changed' | 'account_created' | 'account_deleted'
  tenant: string | number | null
  subject: string | number | null
  subjectEmail?: string | null
  previousRole?: string | null
  newRole?: string | null
  summary: string
}

/** Pure diff — exported so the rule can be tested without a database. */
export function membershipDiff(previous: Row[], submitted: Row[]): Entry[] {
  const before = new Map<string, Row>()
  for (const row of previous) {
    const id = idOf(row.tenant)
    if (id !== null) before.set(String(id), row)
  }
  const after = new Map<string, Row>()
  for (const row of submitted) {
    const id = idOf(row.tenant)
    if (id !== null) after.set(String(id), row)
  }

  const entries: Entry[] = []
  for (const [key, row] of after) {
    const prior = before.get(key)
    const tenant = idOf(row.tenant)
    const role = row.role ?? null
    if (!prior) {
      entries.push({
        action: 'member_added',
        tenant,
        subject: null,
        newRole: role,
        summary: `Added to project ${key} as ${role ?? 'member'}`,
      })
      continue
    }
    if ((prior.role ?? null) !== role) {
      entries.push({
        action: 'role_changed',
        tenant,
        subject: null,
        previousRole: prior.role ?? null,
        newRole: role,
        summary: `Role changed in project ${key}: ${prior.role ?? 'none'} → ${role ?? 'none'}`,
      })
    }
  }
  for (const [key, row] of before) {
    if (after.has(key)) continue
    entries.push({
      action: 'member_removed',
      tenant: idOf(row.tenant),
      subject: null,
      previousRole: row.role ?? null,
      summary: `Removed from project ${key}`,
    })
  }
  return entries
}

function sourceOf(req: PayloadRequest): 'admin' | 'api' | 'bootstrap' {
  if (!req.user) return 'bootstrap'
  const header = req.headers?.get?.('referer') ?? ''
  return header.includes('/admin') ? 'admin' : 'api'
}

async function writeEntries(req: PayloadRequest, entries: Entry[], subject: any, actor: Actor) {
  if (!entries.length) return
  const actorDoc = (req.user as any) ?? actor
  for (const entry of entries) {
    try {
      await req.payload.create({
        collection: 'membership-audit' as any,
        overrideAccess: true,
        req,
        data: {
          ...entry,
          tenant: entry.tenant ?? null,
          subject: entry.subject ?? subject?.id ?? null,
          subjectEmail: entry.subjectEmail ?? subject?.email ?? null,
          actor: actorDoc?.id ?? null,
          actorEmail: actorDoc?.email ?? null,
          source: sourceOf(req),
        },
      })
    } catch (error) {
      // Recording must never roll back a change that already applied.
      req.payload.logger.error(
        { err: error, tenant: entry.tenant, action: entry.action },
        'membership audit write failed',
      )
    }
  }
}

export const auditMembershipChange: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  const previous = rowsOf(previousDoc)
  const current = rowsOf(doc)
  const entries = membershipDiff(previous, current)
  if (!entries.length) return doc

  // Annotate the person added in this mutation when there is exactly one.
  const onlySubject = entries.length === 1 ? doc : null
  await writeEntries(req, entries, onlySubject, req.user as Actor)
  return doc
}

export const auditAccountCreate: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc
  const entries: Entry[] = [
    {
      action: 'account_created',
      tenant: null,
      subject: doc.id,
      subjectEmail: doc.email,
      newRole: doc.globalRole ?? null,
      summary: `Account created for ${doc.email}`,
    },
  ]
  // The account's initial project memberships are recorded after creation.
  for (const row of rowsOf(doc)) {
    const tenant = idOf(row.tenant)
    if (tenant === null) continue
    entries.push({
      action: 'member_added',
      tenant,
      subject: doc.id,
      newRole: row.role ?? null,
      summary: `Added to project ${tenant} as ${row.role ?? 'member'}`,
    })
  }
  await writeEntries(req, entries, doc, req.user as Actor)
  return doc
}

export const auditAccountDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await writeEntries(
    req,
    [
      {
        action: 'account_deleted',
        tenant: null,
        // The account no longer exists, so a subject foreign key would violate
        // its constraint. The email is the durable identifying fact.
        subject: null,
        subjectEmail: doc.email,
        summary: `Account deleted: ${doc.email}`,
      },
    ],
    doc,
    req.user as Actor,
  )
  return doc
}
