import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { s3Storage } from '@payloadcms/storage-s3'
import { buildConfig } from 'payload'
import path from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { isGlobalOwner, TENANT_ROLES } from './access'
import { Media } from './collections/Media'
import { Posts } from './collections/Posts'
import { SiteSettings } from './collections/SiteSettings'
import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import {
  CaseStudies,
  FitGuides,
  PackagingGuides,
  PropertyGuides,
  RegulatoryNotes,
} from './collections/editorial'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const locales = [
  ['English', 'en'], ['العربية', 'ar'], ['Deutsch', 'de'], ['Español', 'es'],
  ['Filipino', 'fil'], ['Français', 'fr'], ['हिन्दी', 'hi'], ['Italiano', 'it'],
  ['日本語', 'ja'], ['한국어', 'ko'], ['فارسی', 'fa'], ['Português', 'pt'],
  ['Русский', 'ru'], ['Türkçe', 'tr'], ['اردو', 'ur'], ['中文', 'zh'],
] as const

const TENANTS = [
  ['Advista', 'advista', 'advistaltd.com'],
  ['EXIM Community', 'exim', 'exim.community'],
  ['Vlobel', 'vlobel', 'vlobel.com'],
  ['Afnosh Packaging', 'afnosh', 'afnosh.com'],
  ['Qasmos', 'qasmos', 'qasmos.com'],
  ['Zamindarr', 'zamindarr', 'zamindarr.com'],
  ['Nagerik', 'nagerik', 'nagerik.com'],
  ['Layyun', 'layyun', 'layyun.net'],
] as const

export default buildConfig({
  admin: { user: Users.slug, importMap: { baseDir: path.resolve(dirname) } },
  collections: [
    Users,
    Tenants,
    Media,
    Posts,
    SiteSettings,
    CaseStudies,
    PackagingGuides,
    FitGuides,
    PropertyGuides,
    RegulatoryNotes,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL,
  localization: {
    defaultLocale: 'en',
    fallback: false,
    locales: locales.map(([label, code]) => ({ label, code })),
  },
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || '' },
  }),
  sharp,
  plugins: [
    multiTenantPlugin({
      cleanupAfterTenantDelete: false,
      tenantsSlug: 'tenants',
      userHasAccessToAllTenants: (user) => isGlobalOwner(user as any),
      tenantsArrayField: {
        includeDefaultField: true,
        arrayFieldName: 'tenants',
        rowFields: [
          {
            name: 'role',
            type: 'select',
            required: true,
            defaultValue: 'viewer',
            options: TENANT_ROLES.map((value) => ({ label: value, value })),
          },
        ],
      },
      collections: {
        posts: {},
        'site-settings': {},
        'case-studies': {},
        'packaging-guides': {},
        'fit-guides': {},
        'property-guides': {},
        'regulatory-notes': {},
        media: {},
      },
    }),
    s3Storage({
      enabled: !!process.env.S3_BUCKET,
      alwaysInsertFields: true,
      bucket: process.env.S3_BUCKET || '',
      disableLocalStorage: true,
      collections: { media: { prefix: 'media' } },
      config: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'us-east-1',
        forcePathStyle: true,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
      },
    }),
  ],
  onInit: async (payload) => {
    // Idempotent tenant bootstrap: create configured projects if absent, never delete or overwrite.
    for (const [name, slug, domain] of TENANTS) {
      const found = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        limit: 1,
        overrideAccess: true,
      })
      if (!found.totalDocs) {
        await payload.create({
          collection: 'tenants',
          data: { name, slug, domain, defaultLocale: 'en' },
          overrideAccess: true,
        })
      }
    }
    // First-owner bootstrap only; ignored once any user exists.
    const email = process.env.PAYLOAD_BOOTSTRAP_OWNER_EMAIL
    const password = process.env.PAYLOAD_BOOTSTRAP_OWNER_PASSWORD
    if (email && password) {
      const users = await payload.count({ collection: 'users', overrideAccess: true })
      if (users.totalDocs === 0) {
        await payload.create({
          collection: 'users',
          data: { email, password, name: 'Owner', globalRole: 'owner' },
          overrideAccess: true,
        })
        payload.logger.info('Bootstrapped the first owner account')
      }
    }
  },
})
