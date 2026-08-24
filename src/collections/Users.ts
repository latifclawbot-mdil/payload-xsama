import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [
    {
      name: 'role', type: 'select', required: true, defaultValue: 'editor',
      options: ['owner', 'publisher', 'editor', 'reviewer', 'viewer'].map((value) => ({ label: value, value })),
      access: { update: ({ req }) => req.user?.role === 'owner' },
    },
    { name: 'organization', type: 'text', required: true, defaultValue: 'XSAMA', access: { update: ({ req }) => req.user?.role === 'owner' } },
  ],
}
