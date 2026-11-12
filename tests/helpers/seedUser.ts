import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

export const testUser = {
  email: 'dev@payloadcms.com',
  password: 'test-password',
  name: 'Test Owner',
  globalRole: 'owner' as const,
}

/** Seeds an owner for e2e admin tests. Requires PAYLOAD_OWNER_EMAILS to include this email. */
export async function seedTestUser(): Promise<void> {
  const payload = await getPayload({ config })
  await payload.delete({ collection: 'users', where: { email: { equals: testUser.email } } })
  await payload.create({ collection: 'users', data: testUser })
}

export async function cleanupTestUser(): Promise<void> {
  const payload = await getPayload({ config })
  await payload.delete({ collection: 'users', where: { email: { equals: testUser.email } } })
}
