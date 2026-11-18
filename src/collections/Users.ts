import type { CollectionConfig } from 'payload'
import { isGlobalOwner } from '../access'
import {
  globalRoleFieldAccess,
  hasAnyTenantRole,
  userDirectoryCreate,
  userDirectoryDelete,
  userDirectoryRead,
  userDirectoryUpdate,
  validateTenantRows,
} from '../membership'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 60 * 60 * 8,
    maxLoginAttempts: 8,
    lockTime: 10 * 60 * 1000,
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'globalRole', 'updatedAt'],
    description: 'Project members. A project owner can add or remove members for their own project only.',
  },
  access: {
    // Any project owner, or a global owner, may reach the member list.
    admin: ({ req }) =>
      isGlobalOwner(req.user as any) || hasAnyTenantRole(req.user as any, ['owner']),
    read: userDirectoryRead(),
    create: userDirectoryCreate,
    update: userDirectoryUpdate,
    delete: userDirectoryDelete,
  },
  hooks: {
    beforeChange: [validateTenantRows],
  },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'globalRole',
      type: 'select',
      defaultValue: 'editor',
      options: ['owner', 'editor'].map((value) => ({ label: value, value })),
      access: {
        create: globalRoleFieldAccess,
        update: globalRoleFieldAccess,
      },
      admin: {
        description:
          'Cross-project authority additionally requires membership of PAYLOAD_OWNER_EMAILS. All other users are scoped by tenant roles.',
      },
    },
  ],
}
