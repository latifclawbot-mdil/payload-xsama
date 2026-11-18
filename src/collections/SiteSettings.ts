import type { CollectionConfig } from 'payload'
import {
  enforceTenantRole,
  tenantMemberRead,
  tenantOperatorFieldRead,
  tenantWriteAccess,
} from '../access'

const write = tenantWriteAccess('site-settings')

/**
 * Per-tenant publishing configuration.
 *
 * One record per project. Site feeds and build automation read this before
 * falling back to defaults, so a missing record is an explicit, visible state
 * rather than a silent assumption.
 */
export const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  admin: {
    useAsTitle: 'siteName',
    defaultColumns: ['siteName', 'tenant', 'domain', 'blogRoot', 'updatedAt'],
    description: 'Publishing configuration for this project.',
  },
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
      name: 'blogRoot',
      type: 'text',
      required: true,
      defaultValue: 'blog',
      admin: {
        description: 'URL segment that hosts all editorial content, e.g. "blog" gives /blog/<section>/<slug>.',
        position: 'sidebar',
      },
      validate: (value: string | null | undefined) => {
        if (!value) return 'Choose a URL segment for the blog.'
        return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
          ? true
          : 'Use lowercase letters, numbers and hyphens only.'
      },
    },
    {
      name: 'enabledSections',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['insights'],
      admin: {
        description: 'Sections that appear in this project’s blog navigation. A section is indexable only once it contains published content.',
      },
      options: [
        { label: 'Insights', value: 'insights' },
        { label: 'Guides', value: 'guides' },
        { label: 'Work / case studies', value: 'work' },
        { label: 'Regulations', value: 'regulations' },
        { label: 'Journal', value: 'journal' },
      ],
    },

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
    {
      name: 'buildHookUrl',
      type: 'text',
      access: {
        read: tenantOperatorFieldRead(),
      },
      admin: {
        description: 'Optional static-host build hook. Publishing or removing content triggers one build per project with a 60-second debounce. Visible to owners, publishers and editors only.',
      },
    },
    {
      name: 'lastBuildStatus',
      type: 'select',
      defaultValue: 'unknown',
      options: [
        { label: 'Unknown', value: 'unknown' },
        { label: 'Requested', value: 'requested' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Failed', value: 'failed' },
        { label: 'Not configured', value: 'unconfigured' },
      ],
      access: {
        // Written by the build hook, never by editors.
        create: () => false,
        update: () => false,
      },
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'lastBuildRequestedAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'lastBuildError', type: 'textarea', admin: { readOnly: true } },

    { name: 'navigation', type: 'array', fields: [{ name: 'label', type: 'text', localized: true }, { name: 'href', type: 'text' }] },
  ],
}
