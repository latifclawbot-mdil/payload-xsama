import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  hasTenantRole,
  isGlobalOwner,
  roleInTenant,
  tenantIds,
  tenantIdOf,
} from '@/access'

const originalOwners = process.env.PAYLOAD_OWNER_EMAILS

const user = {
  email: 'editor@example.com',
  tenants: [
    { tenant: 't-advista', role: 'editor' as const },
    { tenant: { id: 't-qasmos' }, role: 'viewer' as const },
  ],
}

describe('tenant access helpers', () => {
  beforeEach(() => {
    process.env.PAYLOAD_OWNER_EMAILS = 'owner@example.com'
  })
  afterEach(() => {
    if (originalOwners === undefined) delete process.env.PAYLOAD_OWNER_EMAILS
    else process.env.PAYLOAD_OWNER_EMAILS = originalOwners
  })

  it('resolves relationship ids from strings, numbers and objects', () => {
    expect(tenantIdOf('t-1')).toBe('t-1')
    expect(tenantIdOf(7)).toBe(7)
    expect(tenantIdOf({ id: 't-2' })).toBe('t-2')
    expect(tenantIdOf(null)).toBeNull()
  })

  it('defaults to deny without an explicit owner allowlist', () => {
    process.env.PAYLOAD_OWNER_EMAILS = ''
    expect(isGlobalOwner({ email: 'owner@example.com', globalRole: 'owner' })).toBe(false)
    expect(isGlobalOwner(null)).toBe(false)
  })

  it('accepts only allowlisted owner emails', () => {
    expect(isGlobalOwner({ email: 'owner@example.com' })).toBe(true)
    expect(isGlobalOwner({ email: 'other@example.com', globalRole: 'owner' })).toBe(false)
  })

  it('scopes membership and roles per tenant', () => {
    expect(tenantIds(user)).toEqual(['t-advista', 't-qasmos'])
    expect(roleInTenant(user, 't-advista')).toBe('editor')
    expect(roleInTenant(user, 't-qasmos')).toBe('viewer')
    expect(roleInTenant(user, 't-afnosh')).toBeNull()
    expect(hasTenantRole(user, 't-advista', ['publisher', 'editor'])).toBe(true)
    expect(hasTenantRole(user, 't-qasmos', ['publisher', 'editor'])).toBe(false)
    expect(hasTenantRole(user, 't-afnosh', ['viewer'])).toBe(false)
  })

  it('gives allowlisted owners every tenant but no one else', () => {
    const owner = { email: 'owner@example.com', tenants: [] }
    expect(hasTenantRole(owner, 't-afnosh', ['publisher'])).toBe(true)
    expect(hasTenantRole(user, 't-afnosh', ['publisher'])).toBe(false)
  })
})
