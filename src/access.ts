import type { Access, CollectionSlug, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'

export const TENANT_ROLES = ['owner', 'publisher', 'editor', 'reviewer', 'viewer', 'builder'] as const
export type TenantRole = (typeof TENANT_ROLES)[number]

const WRITE_ROLES: TenantRole[] = ['owner', 'publisher', 'editor']
const PUBLISH_ROLES: TenantRole[] = ['owner', 'publisher']
const DRAFT_READ_ROLES: TenantRole[] = ['owner', 'publisher', 'editor', 'reviewer']

type TenantRow = { tenant?: string | number | { id: string | number } | null; role?: TenantRole }
type TenantUser = { email?: string | null; tenants?: TenantRow[]; globalRole?: string | null } | null

const ownerEmails = () =>
  new Set(
    (process.env.PAYLOAD_OWNER_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )

/** Cross-tenant authority is explicit and default-deny. */
export function isGlobalOwner(user: TenantUser): boolean {
  if (!user?.email) return false
  return ownerEmails().has(user.email.toLowerCase())
}

export function tenantIdOf(value: unknown): string | number | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: string | number }).id
    return typeof id === 'string' || typeof id === 'number' ? id : null
  }
  return null
}

export function tenantRows(user: TenantUser): TenantRow[] {
  return Array.isArray(user?.tenants) ? user.tenants : []
}

export function tenantIds(user: TenantUser): Array<string | number> {
  return tenantRows(user)
    .map((row) => tenantIdOf(row.tenant))
    .filter((id): id is string | number => id !== null)
}

export function roleInTenant(user: TenantUser, tenantId: string | number | null): TenantRole | null {
  if (tenantId === null) return null
  if (isGlobalOwner(user)) return 'owner'
  const row = tenantRows(user).find((entry) => String(tenantIdOf(entry.tenant)) === String(tenantId))
  return row?.role && TENANT_ROLES.includes(row.role) ? row.role : null
}

export function hasTenantRole(
  user: TenantUser,
  tenantId: string | number | null,
  roles: readonly TenantRole[],
): boolean {
  if (isGlobalOwner(user)) return true
  const role = roleInTenant(user, tenantId)
  return !!role && roles.includes(role)
}

function anyTenantRole(user: TenantUser, roles: readonly TenantRole[]): boolean {
  if (isGlobalOwner(user)) return true
  return tenantRows(user).some((row) => !!row.role && roles.includes(row.role))
}

/** Public reads expose only published documents; members may see drafts per role. */
export function editorialRead(publicPublished = true): Access {
  return ({ req }) => {
    if (isGlobalOwner(req.user as TenantUser)) return true
    const user = req.user as TenantUser
    const ids = tenantIds(user)
    if (ids.length) {
      const seesDrafts = tenantRows(user).some(
        (row) => !!row.role && DRAFT_READ_ROLES.includes(row.role),
      )
      const tenantScope = { tenant: { in: ids } } as Where
      if (seesDrafts || isGlobalOwner(user)) return tenantScope
      return { and: [tenantScope, { _status: { equals: 'published' } }] } as Where
    }
    if (publicPublished) return { _status: { equals: 'published' } } as Where
    return false
  }
}

/** Authenticated tenant members only; no public fallback. */
export function tenantMemberRead(): Access {
  return ({ req }) => {
    if (isGlobalOwner(req.user as TenantUser)) return true
    const ids = tenantIds(req.user as TenantUser)
    return ids.length ? { tenant: { in: ids } } : false
  }
}

export function tenantWriteAccess(
  collection: CollectionSlug,
  roles: readonly TenantRole[] = WRITE_ROLES,
): {
  create: Access
  update: Access
  delete: Access
} {
  const canWriteDocument = async (req: PayloadRequest, id: string | number) => {
    if (isGlobalOwner(req.user as TenantUser)) return true
    if (!req.user) return false
    const doc = (await req.payload.findByID({
      collection,
      id,
      depth: 0,
      overrideAccess: true,
    })) as { tenant?: unknown }
    return hasTenantRole(req.user as TenantUser, tenantIdOf(doc.tenant), roles)
  }

  return {
    create: ({ req }) => anyTenantRole(req.user as TenantUser, roles),
    update: async ({ req, id }) => (id == null ? false : canWriteDocument(req, id)),
    delete: async ({ req, id }) => (id == null ? false : canWriteDocument(req, id)),
  }
}

export const publishAccess: Access = ({ req }) => anyTenantRole(req.user as TenantUser, PUBLISH_ROLES)

/** Runs on write so a role in tenant A cannot be used to write tenant B. */
export function enforceTenantRole(roles: readonly TenantRole[] = WRITE_ROLES) {
  return async ({ req, data, originalDoc }: any) => {
    if (isGlobalOwner(req.user as TenantUser)) return data
    const tenantId = tenantIdOf(data?.tenant ?? originalDoc?.tenant)
    if (tenantId === null) return data
    if (!req.user || !hasTenantRole(req.user as TenantUser, tenantId, roles)) {
      throw new APIError('Your role in this project does not allow this change.', 403)
    }
    return data
  }
}

export { PUBLISH_ROLES, WRITE_ROLES }
