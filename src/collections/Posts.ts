import type { CollectionConfig } from 'payload'
import { editorialRead, enforceTenantRole, isGlobalOwner, tenantWriteAccess } from '../access'

const write = tenantWriteAccess('posts')

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'tenant', 'publishedAt', '_status', 'updatedAt'] },
  versions: { drafts: true, maxPerDoc: 100 },
  access: {
    read: editorialRead(true),
    create: write.create,
    update: write.update,
    delete: write.delete,
  },
  hooks: { beforeChange: [enforceTenantRole()] },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'slug', type: 'text', required: true, index: true },
    { name: 'excerpt', type: 'textarea', required: true, localized: true, maxLength: 400 },
    { name: 'content', type: 'richText', required: true, localized: true },
    { name: 'coverImage', type: 'upload', relationTo: 'media' },
    {
      name: 'tags',
      type: 'array',
      localized: true,
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    { name: 'publishedAt', type: 'date', required: true, index: true },
    {
      name: 'authorName',
      type: 'text',
      localized: true,
      admin: { description: 'Named author whose work is being published; leave blank for an institutional byline.' },
    },
  ],
}
