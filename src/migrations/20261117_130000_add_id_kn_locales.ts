/**
 * Migration: add the Indonesian (id) and Kannada (kn) locales.
 *
 * Payload derives its `_locales` enum from config, but the enum is a schema
 * object that must be extended explicitly. Without this, querying either
 * locale fails with "invalid input value for enum _locales".
 */
import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TYPE "_locales" ADD VALUE IF NOT EXISTS 'id'`)
  await db.execute(sql`ALTER TYPE "_locales" ADD VALUE IF NOT EXISTS 'kn'`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres cannot remove enum values safely; rows would have to be rewritten
  // first. Leaving the labels in place is the reversible-safe choice.
  void db
}
