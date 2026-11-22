import { describe, expect, it, vi } from 'vitest'

import { preservePublishedUrl } from '@/collections/content-contract'

const published = { id: 11, _status: 'published', slug: 'original-slug', section: 'insights' }
const req = { payload: { logger: { warn: vi.fn() } } }

describe('preservePublishedUrl', () => {
  it('pins slug and section on a published document update but keeps content edits', () => {
    const data = { slug: 'new-slug', section: 'guides', title: 'Edited title' }
    const out = preservePublishedUrl({ data, originalDoc: published, operation: 'update', req })
    expect(out.slug).toBe('original-slug')
    expect(out.section).toBe('insights')
    expect(out.title).toBe('Edited title')
  })

  it('allows identity changes on create', () => {
    const data = { slug: 'new-slug', section: 'guides' }
    const out = preservePublishedUrl({ data, originalDoc: undefined, operation: 'create', req })
    expect(out.slug).toBe('new-slug')
    expect(out.section).toBe('guides')
  })

  it('allows identity changes while the document is unpublished (draft)', () => {
    const data = { slug: 'new-slug', section: 'guides' }
    const out = preservePublishedUrl({ data, originalDoc: { ...published, _status: 'draft' }, operation: 'update', req })
    expect(out.slug).toBe('new-slug')
    expect(out.section).toBe('guides')
  })

  it('leaves an unchanged identity alone', () => {
    const data = { slug: 'original-slug', section: 'insights', title: 'x' }
    const out = preservePublishedUrl({ data, originalDoc: published, operation: 'update', req })
    expect(out.slug).toBe('original-slug')
    expect(out.section).toBe('insights')
    expect(out.title).toBe('x')
  })

  it('does not touch fields that are absent from the incoming data', () => {
    const data = { title: 'only a title edit' }
    const out = preservePublishedUrl({ data, originalDoc: published, operation: 'update', req })
    expect(out.slug).toBeUndefined()
    expect(out.title).toBe('only a title edit')
  })
})