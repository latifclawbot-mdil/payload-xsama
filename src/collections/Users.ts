import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: [
        { label: 'Platform owner', value: 'owner' },
        { label: 'Publisher', value: 'publisher' },
        { label: 'Editor', value: 'editor' },
        { label: 'Reviewer', value: 'reviewer' },
        { label: 'Viewer', value: 'viewer' },
      ],
      access: {
        update: ({ req }) => req.user?.role === 'owner',
      },
    },
    {
      name: 'organization',
      type: 'text',
      required: true,
      defaultValue: 'XSAMA',
      access: {
        update: ({ req }) => req.user?.role === 'owner',
      },
    },
  ],
}
