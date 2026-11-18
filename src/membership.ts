import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'
import type { TenantRole } from './access'
import { TENANT_ROLES, hasTenantRole, isGlobalOwner, tenantIdOf, tenantIds, tenantRows } from './access'

/**
 * Tenant-scoped member management.
 *
 * A project `owner` may manage members of their own project only:
 *  - add or remove members for that project
 *  - assign any role at or below their own rank
 *  - never grant global authority
 *  - never add or edit a row for a project they do not own
 *
 * Global owners (PAYLOAD_OWNER_EMAILS) keep unrestricted authority.
 */

/** Rank order — a manager may assign roles strictly below, or equal to, their own. */
const ROLE_RANK: Record<TenantRole, number> = {
  viewer: 1,
  reviewer: 2,
  editor: 3,
  publisher: 4,
  builder: 4,
  owner: 5,
}

type MembershipRow = { tenant?: unknown; role?: TenantRole }
type AnyUser = { id?: string | number; email?: string | null; tenants?: MembershipRow[] } | null

/** Roles the given user may grant. Unknown or absent roles grant nothing. */
export function assignableRoles(user: AnyUser): TenantRole[] {
  if (isGlobalOwner(user as any)) return [...TENANT_ROLES]
  const highest = tenantRows(user as any).reduce((max, row) => {
    const role = row.role && TENANT_ROLES.includes(row.role) ? row.role : null
    if (!role) return max
    if (role === 'owner') return Math.max(max, ROLE_RANK.owner)
    return Math.max(max, ROLE_RANK[role])
  }, 0)
  if (highest < ROLE_RANK.owner) return []
  return TENANT_ROLES.filter((role) => ROLE_RANK[role] <= ROLE_RANK.owner && role !== 'owner')
}

/** Projects the user may manage members for. Only `owner` qualifies. */
export function manageableTenantIds(user: AnyUser): Array<string | number> {
  if (isGlobalOwner(user as any)) return tenantIds(user as any)
  return tenantRows(user as any)
    .filter((row) => row.role === 'owner')
    .map((row) => tenantIdOf(row.tenant))
    .filter((id): id is string | number => id !== null)
}

export function canManageMembers(user: AnyUser): boolean {
  return isGlobalOwner(user as any) || manageableTenantIds(user).length > 0
}

/** Collection-level read: users you share at least one project with, plus yourself. */
export function userDirectoryRead(): Access {
  return ({ req }) => {
    if (isGlobalOwner(req.user as any)) return true
    const ids = tenantIds(req.user as any)
    if (!req.user) return false
    const self = (req.user as any).id
    if (!ids.length) return { id: { equals: self } }
    return {
      or: [
        { id: { equals: self } },
        { 'tenants.tenant': { in: ids } },
      ],
    } as Where
  }
}

/** Only project owners and global owners may create users. */
export const userDirectoryCreate: Access = ({ req }) => canManageMembers(req.user as AnyUser)

/** Update: self-service profile edits, or member management within your projects. */
export const userDirectoryUpdate: Access = ({ req, id }) => {
  const user = req.user as AnyUser
  if (isGlobalOwner(user as any)) return true
  if (!user) return false
  if (id != null && String((user as any).id) === String(id)) return true
  return canManageMembers(user)
}

/** Deletion stays global — removing an account destroys their history across projects. */
export const userDirectoryDelete: Access = ({ req }) => isGlobalOwner(req.user as any)

/**
 * Row-level guard for the `tenants` array.
 *
 * Runs on create and update. Each submitted row must belong to a project the
 * actor owns, and its role must be one the actor is permitted to assign.
 * Rows belonging to other projects are only allowed if they are unchanged.
 */
export async function validateTenantRows({
  req,
  data,
  originalDoc,
}: {
  req: PayloadRequest
  data?: any
  originalDoc?: any
}): Promise<any> {
  const actor = req.user as AnyUser
  if (isGlobalOwner(actor as any)) return data
  if (!canManageMembers(actor)) {
    if (data?.tenants === undefined) return data
    throw forbidden()
  }

  const submitted: MembershipRow[] = Array.isArray(data?.tenants) ? data.tenants : []
  const previous: MembershipRow[] = Array.isArray(originalDoc?.tenants) ? originalDoc.tenants : []
  const managed = new Set(manageableTenantIds(actor).map(String))
  const allowedRoles = new Set(assignableRoles(actor))
  const previousRows = new Map(previous.map((row) => [String(tenantIdOf(row.tenant)), row]))

  const seen = new Set<string>()
  for (const row of submitted) {
    const key = String(tenantIdOf(row.tenant))
    if (key === 'null' || key === 'undefined') throw forbidden('A member row must reference a project.')
    if (seen.has(key)) throw forbidden('A project may only appear once in a member list.')
    seen.add(key)

    const before = previousRows.get(key)
    const unchanged = !!before && before.role === row.role
    if (!managed.has(key)) {
      // Cross-project rows are immutable for actors who do not own that project.
      if (!unchanged) throw forbidden('You cannot change membership for a project you do not own.')
      continue
    }
    if (row.role && !unchanged && !allowedRoles.has(row.role)) {
      throw forbidden(`You cannot assign the "${row.role}" role.`)
    }
  }

  // Removing rows from projects the actor does not own is equally forbidden.
  for (const key of previousRows.keys()) {
    if (!managed.has(key) && !seen.has(key)) {
      throw forbidden('You cannot remove membership for a project you do not own.')
    }
  }
  return data
}

function forbidden(message = 'Your role does not allow this change.') {
  const error = new Error(message)
  ;(error as any).status = 403
  return error
}

/** Field access for `globalRole` — never editable by tenant-scoped managers. */
export const globalRoleFieldAccess: FieldAccess = ({ req }) => isGlobalOwner(req.user as any)

/** Field access for the tenants array — visible only to people who can manage members. */
export const tenantRowsFieldAccess: FieldAccess = ({ req }) => {
  const user = req.user as AnyUser
  if (isGlobalOwner(user as any)) return true
  if (!canManageMembers(user)) return false
  return true
}

/** Does the actor hold write authority anywhere? Used for directory visibility. */
export function hasAnyTenantRole(user: AnyUser, roles: readonly TenantRole[]): boolean {
  if (isGlobalOwner(user as any)) return true
  return tenantRows(user as any).some((row) => !!row.role && roles.includes(row.role as TenantRole))
}

export function actorHasRoleIn(actor: AnyUser, tenantId: unknown, role: TenantRole): boolean {
  return hasTenantRole(actor as any, tenantIdOf(tenantId), [role])
}
