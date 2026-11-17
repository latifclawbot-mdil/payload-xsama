/**
 * Migration: unified blog + SEO content contract.
 *
 * Adds, to every blog-eligible collection:
 *  - section (canonical /blog/<section> URL segment)
 *  - SEO group (localized title/description/breadcrumb, keywords, canonical override, noindex)
 *  - authorship group (author name/url, reviewer name, reviewedAt)
 *  - citations array
 *  - tags (editorial collections only)
 *  - content_type + faq + how_to_steps (posts only)
 *
 * Only creates columns and tables. No existing column is renamed or dropped.
 * Existing posts are backfilled to section = 'insights', content_type = 'article'.
 */
import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

const LOCALIZED_COLLECTIONS = [
  'posts',
  'case_studies',
  'packaging_guides',
  'fit_guides',
  'property_guides',
  'regulatory_notes',
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const collection of LOCALIZED_COLLECTIONS) {
    const suffix = collection.split('_').map((part) => part[0]).join('')

    await db.execute(sql`
      ALTER TABLE ${sql.raw(`"${collection}"`)} ADD COLUMN IF NOT EXISTS "section" varchar DEFAULT 'insights';
      CREATE INDEX IF NOT EXISTS ${sql.raw(`"${collection}_section_idx"`)} ON ${sql.raw(`"${collection}"`)} USING btree ("section");
      ALTER TABLE ${sql.raw(`"${collection}_locales"`)} ADD COLUMN IF NOT EXISTS "seo_title" varchar;
      ALTER TABLE ${sql.raw(`"${collection}_locales"`)} ADD COLUMN IF NOT EXISTS "seo_description" varchar;
      ALTER TABLE ${sql.raw(`"${collection}_locales"`)} ADD COLUMN IF NOT EXISTS "seo_breadcrumb_label" varchar;
      ALTER TABLE ${sql.raw(`"${collection}_locales"`)} ADD COLUMN IF NOT EXISTS "authorship_author_name" varchar;
      ALTER TABLE ${sql.raw(`"${collection}_locales"`)} ADD COLUMN IF NOT EXISTS "authorship_reviewer_name" varchar;
      ALTER TABLE ${sql.raw(`"${collection}"`)} ADD COLUMN IF NOT EXISTS "seo_canonical_override" varchar;
      ALTER TABLE ${sql.raw(`"${collection}"`)} ADD COLUMN IF NOT EXISTS "seo_noindex" boolean DEFAULT false;
      ALTER TABLE ${sql.raw(`"${collection}"`)} ADD COLUMN IF NOT EXISTS "authorship_author_url" varchar;
      ALTER TABLE ${sql.raw(`"${collection}"`)} ADD COLUMN IF NOT EXISTS "authorship_reviewed_at" timestamp(3) with time zone;
    `)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.raw(`"${collection}_seo_keywords"`)} (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_locale" "_locales" NOT NULL,
        "id" varchar PRIMARY KEY NOT NULL,
        "term" varchar
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ${sql.raw(`"${collection}_seo_keywords_order_idx"`)}
        ON ${sql.raw(`"${collection}_seo_keywords"`)} USING btree ("_order");
      CREATE INDEX IF NOT EXISTS ${sql.raw(`"${collection}_seo_keywords_parent_id_idx"`)}
        ON ${sql.raw(`"${collection}_seo_keywords"`)} USING btree ("_parent_id");
      CREATE INDEX IF NOT EXISTS ${sql.raw(`"${collection}_seo_keywords_locale_idx"`)}
        ON ${sql.raw(`"${collection}_seo_keywords"`)} USING btree ("_locale");
    `)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.raw(`"${collection}_citations"`)} (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" varchar PRIMARY KEY NOT NULL,
        "title" varchar NOT NULL,
        "url" varchar NOT NULL,
        "publisher" varchar,
        "accessed_at" timestamp(3) with time zone
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ${sql.raw(`"${collection}_citations_order_idx"`)}
        ON ${sql.raw(`"${collection}_citations"`)} USING btree ("_order");
      CREATE INDEX IF NOT EXISTS ${sql.raw(`"${collection}_citations_parent_id_idx"`)}
        ON ${sql.raw(`"${collection}_citations"`)} USING btree ("_parent_id");
    `)

    // tags exist on posts already; add them only to editorial collections
    if (collection !== 'posts') {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ${sql.raw(`"${collection}_tags"`)} (
          "_order" integer NOT NULL,
          "_parent_id" integer NOT NULL,
          "id" varchar PRIMARY KEY NOT NULL,
          "_locale" "_locales" NOT NULL,
          "name" varchar
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ${sql.raw(`"${collection}_tags_order_idx"`)}
          ON ${sql.raw(`"${collection}_tags"`)} USING btree ("_order");
        CREATE INDEX IF NOT EXISTS ${sql.raw(`"${collection}_tags_parent_id_idx"`)}
          ON ${sql.raw(`"${collection}_tags"`)} USING btree ("_parent_id");
      `)
    }

    if (collection === 'posts') {
      await db.execute(sql`
        ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "content_type" varchar DEFAULT 'article';
        CREATE TABLE IF NOT EXISTS "posts_faq" (
          "_order" integer NOT NULL,
          "_parent_id" integer NOT NULL,
          "id" varchar PRIMARY KEY NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "posts_faq_locales" (
          "question" varchar,
          "answer" varchar,
          "id" serial PRIMARY KEY NOT NULL,
          "_locale" "_locales" NOT NULL,
          "_parent_id" varchar NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "posts_how_to_steps" (
          "_order" integer NOT NULL,
          "_parent_id" integer NOT NULL,
          "id" varchar PRIMARY KEY NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "posts_how_to_steps_locales" (
          "name" varchar,
          "text" varchar,
          "id" serial PRIMARY KEY NOT NULL,
          "_locale" "_locales" NOT NULL,
          "_parent_id" varchar NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "posts_faq_order_idx" ON "posts_faq" USING btree ("_order");
        CREATE INDEX IF NOT EXISTS "posts_faq_parent_id_idx" ON "posts_faq" USING btree ("_parent_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "posts_faq_locales_locale_parent_id_unique"
          ON "posts_faq_locales" USING btree ("_locale", "_parent_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "posts_how_to_steps_order_idx" ON "posts_how_to_steps" USING btree ("_order");
        CREATE INDEX IF NOT EXISTS "posts_how_to_steps_parent_id_idx" ON "posts_how_to_steps" USING btree ("_parent_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "posts_how_to_steps_locales_locale_parent_id_unique"
          ON "posts_how_to_steps_locales" USING btree ("_locale", "_parent_id");
      `)
    }

    void suffix
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const collection of LOCALIZED_COLLECTIONS) {
    if (collection === 'posts') {
      await db.execute(sql`
        DROP TABLE IF EXISTS "posts_faq_locales";
        DROP TABLE IF EXISTS "posts_faq";
        DROP TABLE IF EXISTS "posts_how_to_steps_locales";
        DROP TABLE IF EXISTS "posts_how_to_steps";
        ALTER TABLE "posts" DROP COLUMN IF EXISTS "content_type";
      `)
    }
    if (collection !== 'posts') {
      await db.execute(sql`
        DROP TABLE IF EXISTS ${sql.raw(`"${collection}_tags"`)};
      `)
    }
    await db.execute(sql`
      DROP TABLE IF EXISTS ${sql.raw(`"${collection}_citations"`)};
      DROP TABLE IF EXISTS ${sql.raw(`"${collection}_seo_keywords"`)};
      ALTER TABLE ${sql.raw(`"${collection}_locales"`)} DROP COLUMN IF EXISTS "seo_title";
      ALTER TABLE ${sql.raw(`"${collection}_locales"`)} DROP COLUMN IF EXISTS "seo_description";
      ALTER TABLE ${sql.raw(`"${collection}_locales"`)} DROP COLUMN IF EXISTS "seo_breadcrumb_label";
      ALTER TABLE ${sql.raw(`"${collection}_locales"`)} DROP COLUMN IF EXISTS "authorship_author_name";
      ALTER TABLE ${sql.raw(`"${collection}_locales"`)} DROP COLUMN IF EXISTS "authorship_reviewer_name";
      ALTER TABLE ${sql.raw(`"${collection}"`)} DROP COLUMN IF EXISTS "seo_canonical_override";
      ALTER TABLE ${sql.raw(`"${collection}"`)} DROP COLUMN IF EXISTS "seo_noindex";
      ALTER TABLE ${sql.raw(`"${collection}"`)} DROP COLUMN IF EXISTS "authorship_author_url";
      ALTER TABLE ${sql.raw(`"${collection}"`)} DROP COLUMN IF EXISTS "authorship_reviewed_at";
      DROP INDEX IF EXISTS ${sql.raw(`"${collection}_section_idx"`)};
      ALTER TABLE ${sql.raw(`"${collection}"`)} DROP COLUMN IF EXISTS "section";
    `)
  }
}
