import type { Access, Where } from 'payload'

type AnyUser = { email?: string | null; tenants?: { tenant?: unknown; role?: string }[]; globalRole?: string | null } | null

const DRAFT_READ_ROLES = ['owner', 'publisher', 'editor', 'reviewer']

/**
 * Locales are only exposed once they hold real translated content.
 *
 * Payload serves locales independently of document status, so a locale that has
 * been enabled but never translated returns a document whose localized fields are
 * empty. Publishing such a page produces a blank, duplicate-URL article.
 *
 * This wraps editorial reads so anonymous requests additionally require the
 * localized title to be present. Authenticated tenant editors keep full draft
 * visibility so they can complete translations.
 */
export function requireTranslatedLocale(base: Access): Access {
  return (args) => {
    const baseConstraint = typeof base === 'function' ? base(args) : base
    if (baseConstraint === false || baseConstraint === null) return baseConstraint

    const req = args.req
    const user = (req?.user ?? null) as AnyUser
    const rows = Array.isArray(user?.tenants) ? user!.tenants! : []
    const canSeeDrafts = rows.some((row) => !!row.role && DRAFT_READ_ROLES.includes(row.role))
    if (user && canSeeDrafts) return baseConstraint

    const translated = { title: { exists: true, not_equals: '' } } as Where
    if (!baseConstraint) return translated
    return { and: [baseConstraint, translated] } as Where
  }
}
