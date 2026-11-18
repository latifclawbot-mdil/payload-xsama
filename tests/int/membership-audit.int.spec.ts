import { describe, expect, it } from 'vitest'

import { membershipDiff } from '../../src/membership-audit'

const row = (tenant: unknown, role?: string) => (role === undefined ? { tenant } : { tenant, role })
const rel = (id: number | string) => ({ id })

describe('membershipDiff', () => {
  it('records nothing when a save does not touch memberships', () => {
    expect(membershipDiff([row(rel(1), 'editor')], [row(rel(1), 'editor')])).toEqual([])
  })

  it('records an added member with their starting role', () => {
    const entries = membershipDiff([], [row(rel(2), 'reviewer')])
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ action: 'member_added', tenant: 2, newRole: 'reviewer' })
  })

  it('records a removal with the role they held', () => {
    const entries = membershipDiff([row(rel(3), 'publisher')], [])
    expect(entries[0]).toMatchObject({ action: 'member_removed', tenant: 3, previousRole: 'publisher' })
  })

  it('records a promotion and a demotion as role changes with both sides', () => {
    const up = membershipDiff([row(rel(1), 'viewer')], [row(rel(1), 'editor')])
    expect(up[0]).toMatchObject({
      action: 'role_changed',
      tenant: 1,
      previousRole: 'viewer',
      newRole: 'editor',
    })

    const down = membershipDiff([row(rel(1), 'publisher')], [row(rel(1), 'viewer')])
    expect(down[0]).toMatchObject({ previousRole: 'publisher', newRole: 'viewer' })
  })

  it('treats a missing role as distinct from an explicit one', () => {
    const entries = membershipDiff([row(rel(4))], [row(rel(4), 'viewer')])
    expect(entries[0]).toMatchObject({ action: 'role_changed', previousRole: null, newRole: 'viewer' })
  })

  it('handles several projects changing in one save', () => {
    const entries = membershipDiff(
      [row(rel(1), 'owner'), row(rel(2), 'editor'), row(rel(3), 'viewer')],
      [row(rel(1), 'publisher'), row(rel(3), 'viewer'), row(rel(4), 'reviewer')],
    )
    expect(entries.map((e) => e.action).sort()).toEqual(['member_added', 'member_removed', 'role_changed'])
    expect(entries.find((e) => e.action === 'member_removed')?.tenant).toBe(2)
    expect(entries.find((e) => e.action === 'member_added')?.tenant).toBe(4)
  })

  it('accepts both raw ids and relationship objects for the same project', () => {
    // A save may round-trip a relationship as an id or an object.
    expect(membershipDiff([row(5, 'editor')], [row(rel(5), 'editor')])).toEqual([])
  })

  it('ignores rows without a resolvable project', () => {
    expect(membershipDiff([], [row(null, 'editor'), row(undefined, 'viewer')])).toEqual([])
  })

  it('never records filesystem-shaped noise such as repeated rows for one project', () => {
    // The last submitted row wins, matching the uniqueness guard in validateTenantRows.
    const entries = membershipDiff([row(rel(1), 'editor')], [row(rel(1), 'editor'), row(rel(1), 'owner')])
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ action: 'role_changed', newRole: 'owner' })
  })
})
