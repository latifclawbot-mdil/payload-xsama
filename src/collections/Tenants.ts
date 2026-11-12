import type { CollectionConfig } from 'payload'
import { isGlobalOwner, tenantIds } from '../access'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'domain', 'updatedAt'],
  },
  access: {
    read: ({ req }) =>
      isGlobalOwner(req.user as any)
        ? true
        : req.user
          ? { id: { in: tenantIds(req.user as any) } }
          : false,
    create: ({ req }) => isGlobalOwner(req.user as any),
    update: ({ req }) => isGlobalOwner(req.user as any),
    delete: ({ req }) => isGlobalOwner(req.user as any),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'domain', type: 'text', required: true, index: true },
    {
      name: 'defaultLocale',
      type: 'select',
      required: true,
      defaultValue: 'en',
      options: [
        'en', 'ar', 'de', 'es', 'fil', 'fr', 'hi', 'it', 'ja', 'ko', 'fa', 'pt', 'ru', 'tr', 'ur', 'zh',
      ].map((value) => ({ label: value, value })),
    },
    { name: 'buildHookUrl', type: 'text', admin: { description: 'Optional static-host build hook for this project.' } },
    { name: 'notes', type: 'textarea' },
  ],
}
