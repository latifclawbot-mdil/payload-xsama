/**
 * Migration: per-project publishing configuration.
 *
 * Adds blog routing fields (blogRoot, enabledSections) and build outcome
 * visibility (lastBuildStatus, lastBuildRequestedAt, lastBuildError) to
 * site_settings. Additive only — no renames, no drops of existing columns.
 *
 * Table and enum shapes match `payload generate:db-schema`.
 */
import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_site_settings_enabled_sections" AS ENUM ('insights', 'guides', 'work', 'regulations', 'journal');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "blog_root" varchar DEFAULT 'blog';
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "last_build_status" varchar DEFAULT 'unknown';
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "last_build_requested_at" timestamp(3) with time zone;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "last_build_error" varchar;
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "site_settings_enabled_sections" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_site_settings_enabled_sections",
      "id" serial PRIMARY KEY NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "site_settings_enabled_sections_order_idx"
      ON "site_settings_enabled_sections" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "site_settings_enabled_sections_parent_idx"
      ON "site_settings_enabled_sections" USING btree ("parent_id");
  `)
  // Existing projects default to a single insights section until configured.
  await db.execute(sql`
    INSERT INTO "site_settings_enabled_sections" ("order", "parent_id", "value")
    SELECT 1, s.id, 'insights'
    FROM "site_settings" s
    WHERE NOT EXISTS (
      SELECT 1 FROM "site_settings_enabled_sections" e WHERE e.parent_id = s.id
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "site_settings_enabled_sections";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "blog_root";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "last_build_status";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "last_build_requested_at";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "last_build_error";
    DROP TYPE IF EXISTS "enum_site_settings_enabled_sections";
  `)
}
