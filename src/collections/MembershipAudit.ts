import type { CollectionConfig } from 'payload'
import { isGlobalOwner } from '../access'

/**
 * Membership and authority audit trail.
 *
 * Every change to who belongs to a project — and at what role — is recorded
 * here, because "who could publish to this site last Tuesday" is the question
 * that follows any incident. Records are written by the user hook only and are
 * never editable or deletable through the API: an audit log that can be
 * rewritten is not an audit log.
 *
 * Reads are restricted to global owners. Project members may change their own
 * membership but must not be able to read other people's history.
 */
export const MembershipAudit: CollectionConfig = {
  slug: 'membership-audit',
  labels: { singular: 'Audit entry', plural: 'Membership audit' },
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['createdAt', 'summary', 'actorEmail', 'tenant', 'action'],
    description: 'Append-only record of project membership changes.',
    group: 'Administration',
  },
  access: {
    // Written by hooks with overrideAccess; no API create/update/delete at all.
    create: () => false,
    update: () => false,
    delete: () => false,
    read: ({ req }) => isGlobalOwner(req.user as any),
  },
  timestamps: true,
  fields: [
    {
      name: 'summary',
      type: 'text',
      required: true,
      admin: { readOnly: true, description: 'One-line description of the change.' },
    },
    {
      name: 'action',
      type: 'select',
      required: true,
      index: true,
      admin: { readOnly: true },
      options: [
        { label: 'Member added', value: 'member_added' },
        { label: 'Member removed', value: 'member_removed' },
        { label: 'Role changed', value: 'role_changed' },
        { label: 'Account created', value: 'account_created' },
        { label: 'Account deleted', value: 'account_deleted' },
      ],
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      index: true,
      admin: { readOnly: true, description: 'Project the change applies to.' },
    },
    {
      name: 'subject',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true, description: 'The person whose membership changed.' },
    },
    { name: 'subjectEmail', type: 'text', admin: { readOnly: true } },
    { name: 'previousRole', type: 'text', admin: { readOnly: true } },
    { name: 'newRole', type: 'text', admin: { readOnly: true } },
    {
      name: 'actor',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true, description: 'Who made the change.' },
    },
    { name: 'actorEmail', type: 'text', admin: { readOnly: true } },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'admin',
      admin: { readOnly: true },
      options: [
        { label: 'Admin panel', value: 'admin' },
        { label: 'API', value: 'api' },
        { label: 'Bootstrap', value: 'bootstrap' },
      ],
    },
  ],
}
