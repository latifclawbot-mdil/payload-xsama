import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assignableRoles,
  canManageMembers,
  manageableTenantIds,
  validateTenantRows,
} from '@/membership'

const originalOwners = process.env.PAYLOAD_OWNER_EMAILS

const reqFor = (user: any) => ({ user }) as any

const ownerA = {
  id: 10,
  email: 'owner-a@example.com',
  tenants: [{ tenant: 't-a', role: 'owner' }],
}
const editorA = {
  id: 11,
  email: 'editor-a@example.com',
  tenants: [{ tenant: 't-a', role: 'editor' }],
}
const ownerAB = {
  id: 12,
  email: 'owner-ab@example.com',
  tenants: [
    { tenant: 't-a', role: 'owner' },
    { tenant: 't-b', role: 'owner' },
  ],
}
const globalOwner = { id: 1, email: 'root@example.com', tenants: [] }

describe('tenant-scoped member management', () => {
  beforeEach(() => {
    process.env.PAYLOAD_OWNER_EMAILS = 'root@example.com'
  })
  afterEach(() => {
    if (originalOwners === undefined) delete process.env.PAYLOAD_OWNER_EMAILS
    else process.env.PAYLOAD_OWNER_EMAILS = originalOwners
  })

  it('only project owners can manage members', () => {
    expect(canManageMembers(ownerA)).toBe(true)
    expect(canManageMembers(editorA)).toBe(false)
    expect(canManageMembers(globalOwner)).toBe(true)
  })

  it('scopes manageable projects to owned tenants', () => {
    expect(manageableTenantIds(ownerA)).toEqual(['t-a'])
    expect(manageableTenantIds(editorA)).toEqual([])
    expect(manageableTenantIds(ownerAB)).toEqual(['t-a', 't-b'])
  })

  it('never lets a project owner grant owner, but lets the global owner', () => {
    expect(assignableRoles(ownerA)).toEqual(['publisher', 'editor', 'reviewer', 'viewer', 'builder'])
    expect(assignableRoles(ownerA)).not.toContain('owner')
    expect(assignableRoles(globalOwner)).toContain('owner')
    expect(assignableRoles(editorA)).toEqual([])
  })

  it('allows adding a member to an owned project', async () => {
    await expect(
      validateTenantRows({
        req: reqFor(ownerA),
        data: { tenants: [{ tenant: 't-a', role: 'editor' }] },
        originalDoc: null,
      }),
    ).resolves.toBeDefined()
  })

  it('refuses to add a member to a project the actor does not own', async () => {
    await expect(
      validateTenantRows({
        req: reqFor(ownerA),
        data: { tenants: [{ tenant: 't-b', role: 'viewer' }] },
        originalDoc: null,
      }),
    ).rejects.toThrow(/project you do not own/)
  })

  it('refuses to grant a role above the manager', async () => {
    await expect(
      validateTenantRows({
        req: reqFor(ownerA),
        data: { tenants: [{ tenant: 't-a', role: 'owner' }] },
        originalDoc: null,
      }),
    ).rejects.toThrow(/cannot assign/)
  })

  it('refuses to remove a membership from a project the actor does not own', async () => {
    await expect(
      validateTenantRows({
        req: reqFor(ownerA),
        data: { tenants: [{ tenant: 't-a', role: 'owner' }] },
        originalDoc: {
          tenants: [
            { tenant: 't-a', role: 'owner' },
            { tenant: 't-b', role: 'viewer' },
          ],
        },
      }),
    ).rejects.toThrow(/cannot remove membership/)
  })

  it('allows untouched rows from other projects', async () => {
    await expect(
      validateTenantRows({
        req: reqFor(ownerA),
        data: {
          tenants: [
            { tenant: 't-a', role: 'editor' },
            { tenant: 't-b', role: 'viewer' },
          ],
        },
        originalDoc: {
          tenants: [
            { tenant: 't-a', role: 'owner' },
            { tenant: 't-b', role: 'viewer' },
          ],
        },
      }),
    ).resolves.toBeDefined()
  })

  it('rejects duplicate project rows', async () => {
    await expect(
      validateTenantRows({
        req: reqFor(ownerA),
        data: {
          tenants: [
            { tenant: 't-a', role: 'viewer' },
            { tenant: 't-a', role: 'editor' },
          ],
        },
        originalDoc: null,
      }),
    ).rejects.toThrow(/only appear once/)
  })

  it('lets the global owner do anything', async () => {
    await expect(
      validateTenantRows({
        req: reqFor(globalOwner),
        data: { tenants: [{ tenant: 't-z', role: 'owner' }] },
        originalDoc: null,
      }),
    ).resolves.toBeDefined()
  })

  it('rejects a non-manager trying to change memberships', async () => {
    await expect(
      validateTenantRows({
        req: reqFor(editorA),
        data: { tenants: [{ tenant: 't-a', role: 'viewer' }] },
        originalDoc: null,
      }),
    ).rejects.toThrow(/does not allow/)
  })
})
