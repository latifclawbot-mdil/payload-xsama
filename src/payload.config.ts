import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { s3Storage } from '@payloadcms/storage-s3'
import { buildConfig } from 'payload'
import path from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { isGlobalOwner, TENANT_ROLES } from './access'
import type { TenantRole } from './access'
import { assignableRoles, tenantRowsFieldAccess } from './membership'
import { Media } from './collections/Media'
import { Posts } from './collections/Posts'
import { SiteSettings } from './collections/SiteSettings'
import { MembershipAudit } from './collections/MembershipAudit'
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
  ['Bahasa Indonesia', 'id'], ['日本語', 'ja'], ['한국어', 'ko'], ['فارسی', 'fa'],
  ['Português', 'pt'], ['Русский', 'ru'], ['Türkçe', 'tr'], ['اردو', 'ur'],
  ['中文', 'zh'], ['ಕನ್ನಡ', 'kn'],
] as const

const TENANTS = [
  ['Advista', 'advista', 'advistaltd.com', ['insights']],
  ['EXIM Community', 'exim', 'exim.community', ['insights', 'regulations']],
  ['Vlobel', 'vlobel', 'vlobel.com', ['insights', 'work', 'regulations']],
  ['Afnosh Packaging', 'afnosh', 'afnosh.com', ['guides']],
  ['Qasmos', 'qasmos', 'qasmos.com', ['work']],
  ['Zamindarr', 'zamindarr', 'zamindarr.com', ['guides', 'regulations']],
  ['Nagerik', 'nagerik', 'nagerik.com', ['guides']],
  ['Layyun', 'layyun', 'layyun.net', ['journal']],
] as const

export default buildConfig({
  admin: { user: Users.slug, importMap: { baseDir: path.resolve(dirname) } },
  collections: [
    Users,
    Tenants,
    Media,
    Posts,
    SiteSettings,
    MembershipAudit,
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
        // Only owners (and global owners) may see or edit the membership array.
        arrayFieldAccess: {
          read: tenantRowsFieldAccess,
          create: tenantRowsFieldAccess,
          update: tenantRowsFieldAccess,
        },
        // Only people who can manage members may see or change project references.
        tenantFieldAccess: {
          read: tenantRowsFieldAccess,
        },
        rowFields: [
          {
            name: 'role',
            type: 'select',
            required: true,
            defaultValue: 'viewer',
            options: TENANT_ROLES.map((value) => ({ label: value, value })),
            validate: (value: string[] | string | null | undefined, { req }: any) => {
              const role = Array.isArray(value) ? value[0] : value
              if (!role) return 'Choose a role for this project.'
              if (isGlobalOwner(req?.user)) return true
              const assignable = assignableRoles(req?.user)
              return assignable.includes(role as TenantRole)
                ? true
                : `You cannot assign the "${role}" role.`
            },
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
    // Bootstrap writes run as the configured global owner so tenant-role guards
    // (which apply to every write, including system boot) remain enforced.
    const bootstrapReq = {
      user: { email: (process.env.PAYLOAD_OWNER_EMAILS || '').split(',')[0]?.trim() },
    } as any
    for (const [name, slug, domain, sections] of TENANTS) {
      const found = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        limit: 1,
        overrideAccess: true,
      })
      let tenant = found.docs[0]
      if (!tenant) {
        tenant = await payload.create({
          collection: 'tenants',
          data: { name, slug, domain, defaultLocale: 'en' },
          overrideAccess: true,
        })
      }

      // One publishing configuration per project. Never overwrite an existing record.
      const settings = await payload.find({
        collection: 'site-settings',
        where: { tenant: { equals: tenant.id } },
        limit: 1,
        overrideAccess: true,
      })
      if (!settings.totalDocs) {
        await payload.create({
          collection: 'site-settings',
          data: {
            tenant: tenant.id,
            siteName: name,
            domain,
            defaultLocale: 'en',
            blogRoot: 'blog',
            enabledSections: [...sections],
            buildTarget: 'netlify',
          },
          overrideAccess: true,
          req: bootstrapReq,
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
