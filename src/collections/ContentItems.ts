import type { CollectionConfig } from 'payload'

const contentRoles = ['owner', 'publisher', 'editor', 'reviewer']

export const ContentItems: CollectionConfig = {
  slug: 'content-items',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'status', 'updatedAt'] },
  versions: { drafts: true, maxPerDoc: 50 },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => contentRoles.includes(String(req.user?.role)),
    delete: ({ req }) => req.user?.role === 'owner',
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'slug', type: 'text', required: true, localized: true, index: true },
    { name: 'contentType', type: 'select', required: true, defaultValue: 'article', options: ['article', 'campaign', 'landing_page', 'social_asset', 'video'].map((value) => ({ label: value, value })) },
    { name: 'status', type: 'select', required: true, defaultValue: 'draft', options: ['draft', 'in_review', 'changes_requested', 'approved', 'scheduled', 'published', 'archived'].map((value) => ({ label: value, value })) },
    { name: 'body', type: 'richText', localized: true },
    { name: 'summary', type: 'textarea', localized: true },
    { name: 'seoTitle', type: 'text', localized: true },
    { name: 'seoDescription', type: 'textarea', localized: true },
    { name: 'heroMedia', type: 'upload', relationTo: 'media' },
    { name: 'rightsExpiry', type: 'date' },
    { name: 'reviewNotes', type: 'textarea' },
    {
      name: 'distributionVariants', type: 'array', fields: [
        { name: 'channel', type: 'select', required: true, options: ['web', 'linkedin', 'x', 'instagram', 'facebook', 'youtube'] },
        { name: 'copy', type: 'textarea', localized: true },
        { name: 'scheduledFor', type: 'date' },
        { name: 'externalDeliveryID', type: 'text', admin: { readOnly: true } },
        { name: 'deliveryStatus', type: 'select', options: ['pending', 'sent', 'failed'], admin: { readOnly: true } },
      ],
    },
  ],
}
