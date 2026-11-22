import type { CollectionConfig } from 'payload'
import { editorialRead, enforceTenantRole, tenantWriteAccess } from '../access'
import { requestRebuildOnDelete, requestRebuildOnPublish } from '../build-trigger'
import { richResultFields, seoFields, validateLocalizedCompleteness, preservePublishedUrl } from './content-contract'

const write = tenantWriteAccess('posts')

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'tenant', 'section', 'publishedAt', '_status', 'updatedAt'] },
  versions: { drafts: true, maxPerDoc: 100 },
  access: {
    read: editorialRead(true),
    create: write.create,
    update: write.update,
    delete: write.delete,
  },
  hooks: {
    beforeChange: [enforceTenantRole(), preservePublishedUrl, validateLocalizedCompleteness],
    afterChange: [requestRebuildOnPublish],
    afterDelete: [requestRebuildOnDelete],
  },
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
      name: 'contentType',
      type: 'select',
      defaultValue: 'article',
      options: ['article', 'guide', 'comparison', 'glossary'].map((value) => ({ label: value, value })),
    },
    ...seoFields,
    ...richResultFields,
  ],
}
