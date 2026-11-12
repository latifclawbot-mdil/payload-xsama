import type { CollectionConfig } from 'payload'
import { isGlobalOwner } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 60 * 60 * 8,
    maxLoginAttempts: 8,
    lockTime: 10 * 60 * 1000,
  },
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'name', 'updatedAt'] },
  access: {
    admin: ({ req }) => isGlobalOwner(req.user as any),
    read: ({ req }) =>
      isGlobalOwner(req.user as any) ? true : req.user ? { id: { equals: req.user.id } } : false,
    create: async ({ req }) => {
      const existing = await req.payload.count({ collection: 'users', overrideAccess: true })
      return existing.totalDocs === 0 || isGlobalOwner(req.user as any)
    },
    update: ({ req, id }) =>
      isGlobalOwner(req.user as any) ? true : !!req.user && String(req.user.id) === String(id),
    delete: ({ req }) => isGlobalOwner(req.user as any),
  },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'globalRole',
      type: 'select',
      defaultValue: 'editor',
      options: ['owner', 'editor'].map((value) => ({ label: value, value })),
      access: {
        create: ({ req }) => isGlobalOwner(req.user as any),
        update: ({ req }) => isGlobalOwner(req.user as any),
      },
      admin: {
        description:
          'Cross-project authority additionally requires membership of PAYLOAD_OWNER_EMAILS. All other users are scoped by tenant roles.',
      },
    },
  ],
}
