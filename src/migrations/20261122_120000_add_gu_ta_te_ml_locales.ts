/**
 * Migration: add the Gujarati (gu), Tamil (ta), Telugu (te) and Malayalam (ml)
 * locales for the Dhanda tenant.
 *
 * Payload derives its `_locales` enum from config, but the enum is a schema
 * object that must be extended explicitly. Without this, querying any of these
 * locales fails with "invalid input value for enum _locales".
 */
import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TYPE "_locales" ADD VALUE IF NOT EXISTS 'gu'`)
  await db.execute(sql`ALTER TYPE "_locales" ADD VALUE IF NOT EXISTS 'ta'`)
  await db.execute(sql`ALTER TYPE "_locales" ADD VALUE IF NOT EXISTS 'te'`)
  await db.execute(sql`ALTER TYPE "_locales" ADD VALUE IF NOT EXISTS 'ml'`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres cannot remove enum values safely; rows would have to be rewritten
  // first. Leaving the labels in place is the reversible-safe choice.
  void db
}