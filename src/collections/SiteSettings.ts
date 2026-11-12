import type { CollectionConfig } from 'payload'
import { enforceTenantRole, tenantMemberRead, tenantWriteAccess } from '../access'

const write = tenantWriteAccess('site-settings')

export const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  admin: { useAsTitle: 'siteName', defaultColumns: ['siteName', 'tenant', 'domain', 'updatedAt'] },
  access: {
    read: tenantMemberRead(),
    create: write.create,
    update: write.update,
    delete: write.delete,
  },
  hooks: { beforeChange: [enforceTenantRole(['owner', 'publisher'])] },
  fields: [
    { name: 'siteName', type: 'text', required: true, localized: true },
    { name: 'domain', type: 'text', required: true },
    { name: 'defaultLocale', type: 'text', required: true, defaultValue: 'en' },
    { name: 'seoTitle', type: 'text', localized: true },
    { name: 'seoDescription', type: 'textarea', localized: true, maxLength: 320 },
    {
      name: 'buildTarget',
      type: 'select',
      required: true,
      defaultValue: 'netlify',
      options: [
        { label: 'Netlify', value: 'netlify' },
        { label: 'Coolify', value: 'coolify' },
        { label: 'None', value: 'none' },
      ],
    },
    { name: 'navigation', type: 'array', fields: [{ name: 'label', type: 'text', localized: true }, { name: 'href', type: 'text' }] },
  ],
}
