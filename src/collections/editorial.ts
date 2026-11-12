import type { CollectionConfig } from 'payload'
import { editorialRead, enforceTenantRole, tenantWriteAccess } from '../access'

function editorial(slug: string, extra: CollectionConfig['fields']): CollectionConfig {
  const write = tenantWriteAccess(slug as any)
  return {
    slug,
    admin: { useAsTitle: 'title', defaultColumns: ['title', 'tenant', '_status', 'updatedAt'] },
    versions: { drafts: true, maxPerDoc: 50 },
    access: { read: editorialRead(true), create: write.create, update: write.update, delete: write.delete },
    hooks: { beforeChange: [enforceTenantRole()] },
    fields: [
      { name: 'title', type: 'text', required: true, localized: true },
      { name: 'slug', type: 'text', required: true, index: true },
      { name: 'excerpt', type: 'textarea', required: true, localized: true, maxLength: 400 },
      { name: 'content', type: 'richText', required: true, localized: true },
      { name: 'coverImage', type: 'upload', relationTo: 'media' },
      ...extra,
    ],
  }
}

export const CaseStudies = editorial('case-studies', [
  { name: 'clientDisclosure', type: 'select', required: true, defaultValue: 'anonymous', options: ['named', 'anonymous'].map((value) => ({ label: value, value })) },
  { name: 'servicesDelivered', type: 'array', fields: [{ name: 'name', type: 'text', required: true }] },
  { name: 'outcomeSummary', type: 'textarea', required: true, localized: true, admin: { description: 'Only outcomes explicitly approved for publication by the client.' } },
])

export const PackagingGuides = editorial('packaging-guides', [
  { name: 'material', type: 'select', options: ['kraft', 'corrugated', 'board', 'other'].map((value) => ({ label: value, value })) },
  { name: 'flute', type: 'select', options: ['B', 'C', 'E', 'BC', 'EB', 'other'].map((value) => ({ label: value, value })) },
  { name: 'sectors', type: 'array', fields: [{ name: 'name', type: 'text', required: true }] },
])

export const FitGuides = editorial('fit-guides', [
  { name: 'measurements', type: 'array', fields: [
    { name: 'label', type: 'text', required: true, localized: true },
    { name: 'value', type: 'text', required: true },
    { name: 'unit', type: 'select', required: true, defaultValue: 'cm', options: ['cm', 'in'].map((value) => ({ label: value, value })) },
  ] },
])

export const PropertyGuides = editorial('property-guides', [
  { name: 'jurisdiction', type: 'text', required: true },
  { name: 'reviewedAt', type: 'date', required: true },
])

export const RegulatoryNotes = editorial('regulatory-notes', [
  { name: 'jurisdiction', type: 'text', required: true },
  { name: 'authority', type: 'text', required: true },
  { name: 'sourceUrl', type: 'text', required: true },
  { name: 'effectiveFrom', type: 'date' },
  { name: 'reviewedAt', type: 'date', required: true },
  { name: 'reviewerName', type: 'text', required: true },
])
