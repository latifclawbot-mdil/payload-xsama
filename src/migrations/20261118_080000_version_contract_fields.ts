/**
 * Migration: content contract fields on draft version tables.
 *
 * The content contract added section, SEO, authorship and citation fields to
 * every editorial collection, but draft versions mirror those fields in
 * `_<collection>_v` tables. Without this, saving a draft fails.
 *
 * Shapes match `payload generate:db-schema`. Additive only.
 */
import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

const COLLECTIONS = [
  'posts',
  'case_studies',
  'packaging_guides',
  'fit_guides',
  'property_guides',
  'regulatory_notes',
] as const

const t = (name: string) => sql.raw(`"${name}"`)

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Enums for the select fields mirrored on version tables.
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum__posts_v_version_content_type" AS ENUM ('article', 'guide', 'comparison', 'glossary');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum__posts_v_version_section" AS ENUM ('insights', 'guides', 'work', 'regulations', 'journal');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  for (const collection of COLLECTIONS) {
    const v = `_${collection}_v`

    await db.execute(sql`
      ALTER TABLE ${t(v)} ADD COLUMN IF NOT EXISTS "version_section" varchar;
      ALTER TABLE ${t(v)} ADD COLUMN IF NOT EXISTS "version_seo_canonical_override" varchar;
      ALTER TABLE ${t(v)} ADD COLUMN IF NOT EXISTS "version_seo_noindex" boolean;
      ALTER TABLE ${t(v)} ADD COLUMN IF NOT EXISTS "version_authorship_author_url" varchar;
      ALTER TABLE ${t(v)} ADD COLUMN IF NOT EXISTS "version_authorship_reviewed_at" timestamp(3) with time zone;
      CREATE INDEX IF NOT EXISTS ${t(`${v}_version_section_idx`)}
        ON ${t(v)} USING btree ("version_section");
    `)

    await db.execute(sql`
      ALTER TABLE ${t(`${v}_locales`)} ADD COLUMN IF NOT EXISTS "version_seo_title" varchar;
      ALTER TABLE ${t(`${v}_locales`)} ADD COLUMN IF NOT EXISTS "version_seo_description" varchar;
      ALTER TABLE ${t(`${v}_locales`)} ADD COLUMN IF NOT EXISTS "version_seo_breadcrumb_label" varchar;
      ALTER TABLE ${t(`${v}_locales`)} ADD COLUMN IF NOT EXISTS "version_authorship_author_name" varchar;
      ALTER TABLE ${t(`${v}_locales`)} ADD COLUMN IF NOT EXISTS "version_authorship_reviewer_name" varchar;
    `)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${t(`${v}_version_seo_keywords`)} (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_locale" "_locales" NOT NULL,
        "id" serial PRIMARY KEY NOT NULL,
        "term" varchar,
        "_uuid" varchar
      );
      CREATE INDEX IF NOT EXISTS ${t(`${v}_version_seo_keywords_order_idx`)}
        ON ${t(`${v}_version_seo_keywords`)} USING btree ("_order");
      CREATE INDEX IF NOT EXISTS ${t(`${v}_version_seo_keywords_parent_id_idx`)}
        ON ${t(`${v}_version_seo_keywords`)} USING btree ("_parent_id");
      CREATE INDEX IF NOT EXISTS ${t(`${v}_version_seo_keywords_locale_idx`)}
        ON ${t(`${v}_version_seo_keywords`)} USING btree ("_locale");

      CREATE TABLE IF NOT EXISTS ${t(`${v}_version_citations`)} (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" serial PRIMARY KEY NOT NULL,
        "title" varchar,
        "url" varchar,
        "publisher" varchar,
        "accessed_at" timestamp(3) with time zone,
        "_uuid" varchar
      );
      CREATE INDEX IF NOT EXISTS ${t(`${v}_version_citations_order_idx`)}
        ON ${t(`${v}_version_citations`)} USING btree ("_order");
      CREATE INDEX IF NOT EXISTS ${t(`${v}_version_citations_parent_id_idx`)}
        ON ${t(`${v}_version_citations`)} USING btree ("_parent_id");
    `)

    if (collection === 'posts') {
      await db.execute(sql`
        ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_content_type" "enum__posts_v_version_content_type" DEFAULT 'article';
        ALTER TABLE "_posts_v" ALTER COLUMN "version_section" TYPE "enum__posts_v_version_section" USING "version_section"::text::"enum__posts_v_version_section";

        CREATE TABLE IF NOT EXISTS "_posts_v_version_faq" (
          "_order" integer NOT NULL,
          "_parent_id" integer NOT NULL,
          "id" serial PRIMARY KEY NOT NULL,
          "_uuid" varchar
        );
        CREATE TABLE IF NOT EXISTS "_posts_v_version_faq_locales" (
          "question" varchar,
          "answer" varchar,
          "id" serial PRIMARY KEY NOT NULL,
          "_locale" "_locales" NOT NULL,
          "_parent_id" integer NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "_posts_v_version_faq_order_idx"
          ON "_posts_v_version_faq" USING btree ("_order");
        CREATE INDEX IF NOT EXISTS "_posts_v_version_faq_parent_id_idx"
          ON "_posts_v_version_faq" USING btree ("_parent_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "_posts_v_version_faq_locales_locale_parent_id_unique"
          ON "_posts_v_version_faq_locales" USING btree ("_locale", "_parent_id");

        CREATE TABLE IF NOT EXISTS "_posts_v_version_how_to_steps" (
          "_order" integer NOT NULL,
          "_parent_id" integer NOT NULL,
          "id" serial PRIMARY KEY NOT NULL,
          "_uuid" varchar
        );
        CREATE TABLE IF NOT EXISTS "_posts_v_version_how_to_steps_locales" (
          "name" varchar,
          "text" varchar,
          "id" serial PRIMARY KEY NOT NULL,
          "_locale" "_locales" NOT NULL,
          "_parent_id" integer NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "_posts_v_version_how_to_steps_order_idx"
          ON "_posts_v_version_how_to_steps" USING btree ("_order");
        CREATE INDEX IF NOT EXISTS "_posts_v_version_how_to_steps_parent_id_idx"
          ON "_posts_v_version_how_to_steps" USING btree ("_parent_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "_posts_v_version_how_to_steps_locales_locale_parent_id_unique"
          ON "_posts_v_version_how_to_steps_locales" USING btree ("_locale", "_parent_id");
      `)
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const collection of COLLECTIONS) {
    const v = `_${collection}_v`
    if (collection === 'posts') {
      await db.execute(sql`
        DROP TABLE IF EXISTS "_posts_v_version_faq_locales";
        DROP TABLE IF EXISTS "_posts_v_version_faq";
        DROP TABLE IF EXISTS "_posts_v_version_how_to_steps_locales";
        DROP TABLE IF EXISTS "_posts_v_version_how_to_steps";
        ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_content_type";
      `)
    }
    await db.execute(sql`
      DROP TABLE IF EXISTS ${t(`${v}_version_citations`)};
      DROP TABLE IF EXISTS ${t(`${v}_version_seo_keywords`)};
      ALTER TABLE ${t(`${v}_locales`)} DROP COLUMN IF EXISTS "version_seo_title";
      ALTER TABLE ${t(`${v}_locales`)} DROP COLUMN IF EXISTS "version_seo_description";
      ALTER TABLE ${t(`${v}_locales`)} DROP COLUMN IF EXISTS "version_seo_breadcrumb_label";
      ALTER TABLE ${t(`${v}_locales`)} DROP COLUMN IF EXISTS "version_authorship_author_name";
      ALTER TABLE ${t(`${v}_locales`)} DROP COLUMN IF EXISTS "version_authorship_reviewer_name";
      DROP INDEX IF EXISTS ${t(`${v}_version_section_idx`)};
      ALTER TABLE ${t(v)} DROP COLUMN IF EXISTS "version_section";
      ALTER TABLE ${t(v)} DROP COLUMN IF EXISTS "version_seo_canonical_override";
      ALTER TABLE ${t(v)} DROP COLUMN IF EXISTS "version_seo_noindex";
      ALTER TABLE ${t(v)} DROP COLUMN IF EXISTS "version_authorship_author_url";
      ALTER TABLE ${t(v)} DROP COLUMN IF EXISTS "version_authorship_reviewed_at";
    `)
  }
}
