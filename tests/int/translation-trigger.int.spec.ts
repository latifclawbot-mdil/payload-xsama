import { describe, expect, it } from 'vitest'

import { translationIdempotencyKey } from '../../src/collections/translation-trigger'

/**
 * The idempotency key is what stops a re-save from paying for the same
 * translation twice, so its properties matter more than its exact value.
 */
describe('translationIdempotencyKey', () => {
  it('is stable for the same post revision', () => {
    const first = translationIdempotencyKey(21, '2026-11-24T09:00:00.000Z')
    const second = translationIdempotencyKey(21, '2026-11-24T09:00:00.000Z')
    expect(first).toBe(second)
  })

  it('changes when the revision changes', () => {
    expect(translationIdempotencyKey(21, '2026-11-24T09:00:00.000Z')).not.toBe(
      translationIdempotencyKey(21, '2026-11-24T10:00:00.000Z'),
    )
  })

  it('changes when the post changes', () => {
    expect(translationIdempotencyKey(21, 'same')).not.toBe(translationIdempotencyKey(22, 'same'))
  })

  it('is a short opaque digest, not a readable identifier', () => {
    const key = translationIdempotencyKey(21, '2026-11-24T09:00:00.000Z')
    expect(key).toMatch(/^[0-9a-f]{32}$/)
    expect(key).not.toContain('21')
  })
})
