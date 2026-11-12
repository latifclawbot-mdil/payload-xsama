import type { CollectionConfig } from 'payload'
import { enforceTenantRole, tenantWriteAccess } from '../access'

const write = tenantWriteAccess('media')

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: write.create,
    update: write.update,
    delete: write.delete,
  },
  hooks: { beforeChange: [enforceTenantRole()] },
  fields: [
    { name: 'alt', type: 'text', required: true },
    { name: 'caption', type: 'text' },
  ],
  upload: {
    mimeTypes: ['image/*', 'application/pdf'],
  },
}
