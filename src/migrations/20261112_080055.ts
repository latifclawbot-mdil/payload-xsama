import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'ar', 'de', 'es', 'fil', 'fr', 'hi', 'it', 'ja', 'ko', 'fa', 'pt', 'ru', 'tr', 'ur', 'zh');
  CREATE TYPE "public"."enum_users_tenants_role" AS ENUM('owner', 'publisher', 'editor', 'reviewer', 'viewer', 'builder');
  CREATE TYPE "public"."enum_users_global_role" AS ENUM('owner', 'editor');
  CREATE TYPE "public"."enum_tenants_default_locale" AS ENUM('en', 'ar', 'de', 'es', 'fil', 'fr', 'hi', 'it', 'ja', 'ko', 'fa', 'pt', 'ru', 'tr', 'ur', 'zh');
  CREATE TYPE "public"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__posts_v_published_locale" AS ENUM('en', 'ar', 'de', 'es', 'fil', 'fr', 'hi', 'it', 'ja', 'ko', 'fa', 'pt', 'ru', 'tr', 'ur', 'zh');
  CREATE TYPE "public"."enum_site_settings_build_target" AS ENUM('netlify', 'coolify', 'none');
  CREATE TYPE "public"."enum_case_studies_client_disclosure" AS ENUM('named', 'anonymous');
  CREATE TYPE "public"."enum_case_studies_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__case_studies_v_version_client_disclosure" AS ENUM('named', 'anonymous');
  CREATE TYPE "public"."enum__case_studies_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__case_studies_v_published_locale" AS ENUM('en', 'ar', 'de', 'es', 'fil', 'fr', 'hi', 'it', 'ja', 'ko', 'fa', 'pt', 'ru', 'tr', 'ur', 'zh');
  CREATE TYPE "public"."enum_packaging_guides_material" AS ENUM('kraft', 'corrugated', 'board', 'other');
  CREATE TYPE "public"."enum_packaging_guides_flute" AS ENUM('B', 'C', 'E', 'BC', 'EB', 'other');
  CREATE TYPE "public"."enum_packaging_guides_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__packaging_guides_v_version_material" AS ENUM('kraft', 'corrugated', 'board', 'other');
  CREATE TYPE "public"."enum__packaging_guides_v_version_flute" AS ENUM('B', 'C', 'E', 'BC', 'EB', 'other');
  CREATE TYPE "public"."enum__packaging_guides_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__packaging_guides_v_published_locale" AS ENUM('en', 'ar', 'de', 'es', 'fil', 'fr', 'hi', 'it', 'ja', 'ko', 'fa', 'pt', 'ru', 'tr', 'ur', 'zh');
  CREATE TYPE "public"."enum_fit_guides_measurements_unit" AS ENUM('cm', 'in');
  CREATE TYPE "public"."enum_fit_guides_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__fit_guides_v_version_measurements_unit" AS ENUM('cm', 'in');
  CREATE TYPE "public"."enum__fit_guides_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__fit_guides_v_published_locale" AS ENUM('en', 'ar', 'de', 'es', 'fil', 'fr', 'hi', 'it', 'ja', 'ko', 'fa', 'pt', 'ru', 'tr', 'ur', 'zh');
  CREATE TYPE "public"."enum_property_guides_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__property_guides_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__property_guides_v_published_locale" AS ENUM('en', 'ar', 'de', 'es', 'fil', 'fr', 'hi', 'it', 'ja', 'ko', 'fa', 'pt', 'ru', 'tr', 'ur', 'zh');
  CREATE TYPE "public"."enum_regulatory_notes_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__regulatory_notes_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__regulatory_notes_v_published_locale" AS ENUM('en', 'ar', 'de', 'es', 'fil', 'fr', 'hi', 'it', 'ja', 'ko', 'fa', 'pt', 'ru', 'tr', 'ur', 'zh');
  CREATE TABLE "users_tenants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"role" "enum_users_tenants_role" DEFAULT 'viewer' NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"global_role" "enum_users_global_role" DEFAULT 'editor',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "tenants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"domain" varchar NOT NULL,
  	"default_locale" "enum_tenants_default_locale" DEFAULT 'en' NOT NULL,
  	"build_hook_url" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"prefix" varchar DEFAULT 'media',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "posts_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"slug" varchar,
  	"cover_image_id" integer,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "posts_locales" (
  	"title" varchar,
  	"excerpt" varchar,
  	"content" jsonb,
  	"author_name" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_posts_v_version_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_tenant_id" integer,
  	"version_slug" varchar,
  	"version_cover_image_id" integer,
  	"version_published_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__posts_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_posts_v_locales" (
  	"version_title" varchar,
  	"version_excerpt" varchar,
  	"version_content" jsonb,
  	"version_author_name" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "site_settings_navigation" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"href" varchar
  );
  
  CREATE TABLE "site_settings_navigation_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"domain" varchar NOT NULL,
  	"default_locale" varchar DEFAULT 'en' NOT NULL,
  	"build_target" "enum_site_settings_build_target" DEFAULT 'netlify' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings_locales" (
  	"site_name" varchar NOT NULL,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "case_studies_services_delivered" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "case_studies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"slug" varchar,
  	"cover_image_id" integer,
  	"client_disclosure" "enum_case_studies_client_disclosure" DEFAULT 'anonymous',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_case_studies_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "case_studies_locales" (
  	"title" varchar,
  	"excerpt" varchar,
  	"content" jsonb,
  	"outcome_summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_case_studies_v_version_services_delivered" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_case_studies_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_tenant_id" integer,
  	"version_slug" varchar,
  	"version_cover_image_id" integer,
  	"version_client_disclosure" "enum__case_studies_v_version_client_disclosure" DEFAULT 'anonymous',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__case_studies_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__case_studies_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_case_studies_v_locales" (
  	"version_title" varchar,
  	"version_excerpt" varchar,
  	"version_content" jsonb,
  	"version_outcome_summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "packaging_guides_sectors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "packaging_guides" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"slug" varchar,
  	"cover_image_id" integer,
  	"material" "enum_packaging_guides_material",
  	"flute" "enum_packaging_guides_flute",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_packaging_guides_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "packaging_guides_locales" (
  	"title" varchar,
  	"excerpt" varchar,
  	"content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_packaging_guides_v_version_sectors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_packaging_guides_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_tenant_id" integer,
  	"version_slug" varchar,
  	"version_cover_image_id" integer,
  	"version_material" "enum__packaging_guides_v_version_material",
  	"version_flute" "enum__packaging_guides_v_version_flute",
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__packaging_guides_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__packaging_guides_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_packaging_guides_v_locales" (
  	"version_title" varchar,
  	"version_excerpt" varchar,
  	"version_content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "fit_guides_measurements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"unit" "enum_fit_guides_measurements_unit" DEFAULT 'cm'
  );
  
  CREATE TABLE "fit_guides_measurements_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "fit_guides" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"slug" varchar,
  	"cover_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_fit_guides_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "fit_guides_locales" (
  	"title" varchar,
  	"excerpt" varchar,
  	"content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_fit_guides_v_version_measurements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"unit" "enum__fit_guides_v_version_measurements_unit" DEFAULT 'cm',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_fit_guides_v_version_measurements_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_fit_guides_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_tenant_id" integer,
  	"version_slug" varchar,
  	"version_cover_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__fit_guides_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__fit_guides_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_fit_guides_v_locales" (
  	"version_title" varchar,
  	"version_excerpt" varchar,
  	"version_content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "property_guides" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"slug" varchar,
  	"cover_image_id" integer,
  	"jurisdiction" varchar,
  	"reviewed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_property_guides_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "property_guides_locales" (
  	"title" varchar,
  	"excerpt" varchar,
  	"content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_property_guides_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_tenant_id" integer,
  	"version_slug" varchar,
  	"version_cover_image_id" integer,
  	"version_jurisdiction" varchar,
  	"version_reviewed_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__property_guides_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__property_guides_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_property_guides_v_locales" (
  	"version_title" varchar,
  	"version_excerpt" varchar,
  	"version_content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "regulatory_notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"slug" varchar,
  	"cover_image_id" integer,
  	"jurisdiction" varchar,
  	"authority" varchar,
  	"source_url" varchar,
  	"effective_from" timestamp(3) with time zone,
  	"reviewed_at" timestamp(3) with time zone,
  	"reviewer_name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_regulatory_notes_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "regulatory_notes_locales" (
  	"title" varchar,
  	"excerpt" varchar,
  	"content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_regulatory_notes_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_tenant_id" integer,
  	"version_slug" varchar,
  	"version_cover_image_id" integer,
  	"version_jurisdiction" varchar,
  	"version_authority" varchar,
  	"version_source_url" varchar,
  	"version_effective_from" timestamp(3) with time zone,
  	"version_reviewed_at" timestamp(3) with time zone,
  	"version_reviewer_name" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__regulatory_notes_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__regulatory_notes_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_regulatory_notes_v_locales" (
  	"version_title" varchar,
  	"version_excerpt" varchar,
  	"version_content" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"tenants_id" integer,
  	"media_id" integer,
  	"posts_id" integer,
  	"site_settings_id" integer,
  	"case_studies_id" integer,
  	"packaging_guides_id" integer,
  	"fit_guides_id" integer,
  	"property_guides_id" integer,
  	"regulatory_notes_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_tags" ADD CONSTRAINT "posts_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_locales" ADD CONSTRAINT "posts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_version_tags" ADD CONSTRAINT "_posts_v_version_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v_locales" ADD CONSTRAINT "_posts_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_navigation" ADD CONSTRAINT "site_settings_navigation_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_navigation_locales" ADD CONSTRAINT "site_settings_navigation_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings_navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings_locales" ADD CONSTRAINT "site_settings_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "case_studies_services_delivered" ADD CONSTRAINT "case_studies_services_delivered_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."case_studies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "case_studies_locales" ADD CONSTRAINT "case_studies_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."case_studies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_case_studies_v_version_services_delivered" ADD CONSTRAINT "_case_studies_v_version_services_delivered_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_case_studies_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_case_studies_v" ADD CONSTRAINT "_case_studies_v_parent_id_case_studies_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."case_studies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_case_studies_v" ADD CONSTRAINT "_case_studies_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_case_studies_v" ADD CONSTRAINT "_case_studies_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_case_studies_v_locales" ADD CONSTRAINT "_case_studies_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_case_studies_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "packaging_guides_sectors" ADD CONSTRAINT "packaging_guides_sectors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."packaging_guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "packaging_guides" ADD CONSTRAINT "packaging_guides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "packaging_guides" ADD CONSTRAINT "packaging_guides_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "packaging_guides_locales" ADD CONSTRAINT "packaging_guides_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."packaging_guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_packaging_guides_v_version_sectors" ADD CONSTRAINT "_packaging_guides_v_version_sectors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_packaging_guides_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_packaging_guides_v" ADD CONSTRAINT "_packaging_guides_v_parent_id_packaging_guides_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."packaging_guides"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_packaging_guides_v" ADD CONSTRAINT "_packaging_guides_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_packaging_guides_v" ADD CONSTRAINT "_packaging_guides_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_packaging_guides_v_locales" ADD CONSTRAINT "_packaging_guides_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_packaging_guides_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "fit_guides_measurements" ADD CONSTRAINT "fit_guides_measurements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."fit_guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "fit_guides_measurements_locales" ADD CONSTRAINT "fit_guides_measurements_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."fit_guides_measurements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "fit_guides" ADD CONSTRAINT "fit_guides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "fit_guides" ADD CONSTRAINT "fit_guides_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "fit_guides_locales" ADD CONSTRAINT "fit_guides_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."fit_guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_fit_guides_v_version_measurements" ADD CONSTRAINT "_fit_guides_v_version_measurements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_fit_guides_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_fit_guides_v_version_measurements_locales" ADD CONSTRAINT "_fit_guides_v_version_measurements_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_fit_guides_v_version_measurements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_fit_guides_v" ADD CONSTRAINT "_fit_guides_v_parent_id_fit_guides_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."fit_guides"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_fit_guides_v" ADD CONSTRAINT "_fit_guides_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_fit_guides_v" ADD CONSTRAINT "_fit_guides_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_fit_guides_v_locales" ADD CONSTRAINT "_fit_guides_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_fit_guides_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "property_guides" ADD CONSTRAINT "property_guides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "property_guides" ADD CONSTRAINT "property_guides_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "property_guides_locales" ADD CONSTRAINT "property_guides_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."property_guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_property_guides_v" ADD CONSTRAINT "_property_guides_v_parent_id_property_guides_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."property_guides"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_property_guides_v" ADD CONSTRAINT "_property_guides_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_property_guides_v" ADD CONSTRAINT "_property_guides_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_property_guides_v_locales" ADD CONSTRAINT "_property_guides_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_property_guides_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "regulatory_notes" ADD CONSTRAINT "regulatory_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "regulatory_notes" ADD CONSTRAINT "regulatory_notes_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "regulatory_notes_locales" ADD CONSTRAINT "regulatory_notes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."regulatory_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_regulatory_notes_v" ADD CONSTRAINT "_regulatory_notes_v_parent_id_regulatory_notes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."regulatory_notes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_regulatory_notes_v" ADD CONSTRAINT "_regulatory_notes_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_regulatory_notes_v" ADD CONSTRAINT "_regulatory_notes_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_regulatory_notes_v_locales" ADD CONSTRAINT "_regulatory_notes_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_regulatory_notes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_settings_fk" FOREIGN KEY ("site_settings_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_case_studies_fk" FOREIGN KEY ("case_studies_id") REFERENCES "public"."case_studies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_packaging_guides_fk" FOREIGN KEY ("packaging_guides_id") REFERENCES "public"."packaging_guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fit_guides_fk" FOREIGN KEY ("fit_guides_id") REFERENCES "public"."fit_guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_property_guides_fk" FOREIGN KEY ("property_guides_id") REFERENCES "public"."property_guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_regulatory_notes_fk" FOREIGN KEY ("regulatory_notes_id") REFERENCES "public"."regulatory_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_tenants_order_idx" ON "users_tenants" USING btree ("_order");
  CREATE INDEX "users_tenants_parent_id_idx" ON "users_tenants" USING btree ("_parent_id");
  CREATE INDEX "users_tenants_tenant_idx" ON "users_tenants" USING btree ("tenant_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");
  CREATE INDEX "tenants_domain_idx" ON "tenants" USING btree ("domain");
  CREATE INDEX "tenants_updated_at_idx" ON "tenants" USING btree ("updated_at");
  CREATE INDEX "tenants_created_at_idx" ON "tenants" USING btree ("created_at");
  CREATE INDEX "media_tenant_idx" ON "media" USING btree ("tenant_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "posts_tags_order_idx" ON "posts_tags" USING btree ("_order");
  CREATE INDEX "posts_tags_parent_id_idx" ON "posts_tags" USING btree ("_parent_id");
  CREATE INDEX "posts_tags_locale_idx" ON "posts_tags" USING btree ("_locale");
  CREATE INDEX "posts_tenant_idx" ON "posts" USING btree ("tenant_id");
  CREATE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");
  CREATE INDEX "posts_cover_image_idx" ON "posts" USING btree ("cover_image_id");
  CREATE INDEX "posts_published_at_idx" ON "posts" USING btree ("published_at");
  CREATE INDEX "posts_updated_at_idx" ON "posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");
  CREATE INDEX "posts__status_idx" ON "posts" USING btree ("_status");
  CREATE UNIQUE INDEX "posts_locales_locale_parent_id_unique" ON "posts_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_posts_v_version_tags_order_idx" ON "_posts_v_version_tags" USING btree ("_order");
  CREATE INDEX "_posts_v_version_tags_parent_id_idx" ON "_posts_v_version_tags" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_version_tags_locale_idx" ON "_posts_v_version_tags" USING btree ("_locale");
  CREATE INDEX "_posts_v_parent_idx" ON "_posts_v" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_version_tenant_idx" ON "_posts_v" USING btree ("version_tenant_id");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "_posts_v" USING btree ("version_slug");
  CREATE INDEX "_posts_v_version_version_cover_image_idx" ON "_posts_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_posts_v_version_version_published_at_idx" ON "_posts_v" USING btree ("version_published_at");
  CREATE INDEX "_posts_v_version_version_updated_at_idx" ON "_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_posts_v_version_version_created_at_idx" ON "_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "_posts_v" USING btree ("version__status");
  CREATE INDEX "_posts_v_created_at_idx" ON "_posts_v" USING btree ("created_at");
  CREATE INDEX "_posts_v_updated_at_idx" ON "_posts_v" USING btree ("updated_at");
  CREATE INDEX "_posts_v_snapshot_idx" ON "_posts_v" USING btree ("snapshot");
  CREATE INDEX "_posts_v_published_locale_idx" ON "_posts_v" USING btree ("published_locale");
  CREATE INDEX "_posts_v_latest_idx" ON "_posts_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_posts_v_locales_locale_parent_id_unique" ON "_posts_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "site_settings_navigation_order_idx" ON "site_settings_navigation" USING btree ("_order");
  CREATE INDEX "site_settings_navigation_parent_id_idx" ON "site_settings_navigation" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "site_settings_navigation_locales_locale_parent_id_unique" ON "site_settings_navigation_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "site_settings_tenant_idx" ON "site_settings" USING btree ("tenant_id");
  CREATE INDEX "site_settings_updated_at_idx" ON "site_settings" USING btree ("updated_at");
  CREATE INDEX "site_settings_created_at_idx" ON "site_settings" USING btree ("created_at");
  CREATE UNIQUE INDEX "site_settings_locales_locale_parent_id_unique" ON "site_settings_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "case_studies_services_delivered_order_idx" ON "case_studies_services_delivered" USING btree ("_order");
  CREATE INDEX "case_studies_services_delivered_parent_id_idx" ON "case_studies_services_delivered" USING btree ("_parent_id");
  CREATE INDEX "case_studies_tenant_idx" ON "case_studies" USING btree ("tenant_id");
  CREATE INDEX "case_studies_slug_idx" ON "case_studies" USING btree ("slug");
  CREATE INDEX "case_studies_cover_image_idx" ON "case_studies" USING btree ("cover_image_id");
  CREATE INDEX "case_studies_updated_at_idx" ON "case_studies" USING btree ("updated_at");
  CREATE INDEX "case_studies_created_at_idx" ON "case_studies" USING btree ("created_at");
  CREATE INDEX "case_studies__status_idx" ON "case_studies" USING btree ("_status");
  CREATE UNIQUE INDEX "case_studies_locales_locale_parent_id_unique" ON "case_studies_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_case_studies_v_version_services_delivered_order_idx" ON "_case_studies_v_version_services_delivered" USING btree ("_order");
  CREATE INDEX "_case_studies_v_version_services_delivered_parent_id_idx" ON "_case_studies_v_version_services_delivered" USING btree ("_parent_id");
  CREATE INDEX "_case_studies_v_parent_idx" ON "_case_studies_v" USING btree ("parent_id");
  CREATE INDEX "_case_studies_v_version_version_tenant_idx" ON "_case_studies_v" USING btree ("version_tenant_id");
  CREATE INDEX "_case_studies_v_version_version_slug_idx" ON "_case_studies_v" USING btree ("version_slug");
  CREATE INDEX "_case_studies_v_version_version_cover_image_idx" ON "_case_studies_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_case_studies_v_version_version_updated_at_idx" ON "_case_studies_v" USING btree ("version_updated_at");
  CREATE INDEX "_case_studies_v_version_version_created_at_idx" ON "_case_studies_v" USING btree ("version_created_at");
  CREATE INDEX "_case_studies_v_version_version__status_idx" ON "_case_studies_v" USING btree ("version__status");
  CREATE INDEX "_case_studies_v_created_at_idx" ON "_case_studies_v" USING btree ("created_at");
  CREATE INDEX "_case_studies_v_updated_at_idx" ON "_case_studies_v" USING btree ("updated_at");
  CREATE INDEX "_case_studies_v_snapshot_idx" ON "_case_studies_v" USING btree ("snapshot");
  CREATE INDEX "_case_studies_v_published_locale_idx" ON "_case_studies_v" USING btree ("published_locale");
  CREATE INDEX "_case_studies_v_latest_idx" ON "_case_studies_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_case_studies_v_locales_locale_parent_id_unique" ON "_case_studies_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "packaging_guides_sectors_order_idx" ON "packaging_guides_sectors" USING btree ("_order");
  CREATE INDEX "packaging_guides_sectors_parent_id_idx" ON "packaging_guides_sectors" USING btree ("_parent_id");
  CREATE INDEX "packaging_guides_tenant_idx" ON "packaging_guides" USING btree ("tenant_id");
  CREATE INDEX "packaging_guides_slug_idx" ON "packaging_guides" USING btree ("slug");
  CREATE INDEX "packaging_guides_cover_image_idx" ON "packaging_guides" USING btree ("cover_image_id");
  CREATE INDEX "packaging_guides_updated_at_idx" ON "packaging_guides" USING btree ("updated_at");
  CREATE INDEX "packaging_guides_created_at_idx" ON "packaging_guides" USING btree ("created_at");
  CREATE INDEX "packaging_guides__status_idx" ON "packaging_guides" USING btree ("_status");
  CREATE UNIQUE INDEX "packaging_guides_locales_locale_parent_id_unique" ON "packaging_guides_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_packaging_guides_v_version_sectors_order_idx" ON "_packaging_guides_v_version_sectors" USING btree ("_order");
  CREATE INDEX "_packaging_guides_v_version_sectors_parent_id_idx" ON "_packaging_guides_v_version_sectors" USING btree ("_parent_id");
  CREATE INDEX "_packaging_guides_v_parent_idx" ON "_packaging_guides_v" USING btree ("parent_id");
  CREATE INDEX "_packaging_guides_v_version_version_tenant_idx" ON "_packaging_guides_v" USING btree ("version_tenant_id");
  CREATE INDEX "_packaging_guides_v_version_version_slug_idx" ON "_packaging_guides_v" USING btree ("version_slug");
  CREATE INDEX "_packaging_guides_v_version_version_cover_image_idx" ON "_packaging_guides_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_packaging_guides_v_version_version_updated_at_idx" ON "_packaging_guides_v" USING btree ("version_updated_at");
  CREATE INDEX "_packaging_guides_v_version_version_created_at_idx" ON "_packaging_guides_v" USING btree ("version_created_at");
  CREATE INDEX "_packaging_guides_v_version_version__status_idx" ON "_packaging_guides_v" USING btree ("version__status");
  CREATE INDEX "_packaging_guides_v_created_at_idx" ON "_packaging_guides_v" USING btree ("created_at");
  CREATE INDEX "_packaging_guides_v_updated_at_idx" ON "_packaging_guides_v" USING btree ("updated_at");
  CREATE INDEX "_packaging_guides_v_snapshot_idx" ON "_packaging_guides_v" USING btree ("snapshot");
  CREATE INDEX "_packaging_guides_v_published_locale_idx" ON "_packaging_guides_v" USING btree ("published_locale");
  CREATE INDEX "_packaging_guides_v_latest_idx" ON "_packaging_guides_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_packaging_guides_v_locales_locale_parent_id_unique" ON "_packaging_guides_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "fit_guides_measurements_order_idx" ON "fit_guides_measurements" USING btree ("_order");
  CREATE INDEX "fit_guides_measurements_parent_id_idx" ON "fit_guides_measurements" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "fit_guides_measurements_locales_locale_parent_id_unique" ON "fit_guides_measurements_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "fit_guides_tenant_idx" ON "fit_guides" USING btree ("tenant_id");
  CREATE INDEX "fit_guides_slug_idx" ON "fit_guides" USING btree ("slug");
  CREATE INDEX "fit_guides_cover_image_idx" ON "fit_guides" USING btree ("cover_image_id");
  CREATE INDEX "fit_guides_updated_at_idx" ON "fit_guides" USING btree ("updated_at");
  CREATE INDEX "fit_guides_created_at_idx" ON "fit_guides" USING btree ("created_at");
  CREATE INDEX "fit_guides__status_idx" ON "fit_guides" USING btree ("_status");
  CREATE UNIQUE INDEX "fit_guides_locales_locale_parent_id_unique" ON "fit_guides_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_fit_guides_v_version_measurements_order_idx" ON "_fit_guides_v_version_measurements" USING btree ("_order");
  CREATE INDEX "_fit_guides_v_version_measurements_parent_id_idx" ON "_fit_guides_v_version_measurements" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_fit_guides_v_version_measurements_locales_locale_parent_id_" ON "_fit_guides_v_version_measurements_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_fit_guides_v_parent_idx" ON "_fit_guides_v" USING btree ("parent_id");
  CREATE INDEX "_fit_guides_v_version_version_tenant_idx" ON "_fit_guides_v" USING btree ("version_tenant_id");
  CREATE INDEX "_fit_guides_v_version_version_slug_idx" ON "_fit_guides_v" USING btree ("version_slug");
  CREATE INDEX "_fit_guides_v_version_version_cover_image_idx" ON "_fit_guides_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_fit_guides_v_version_version_updated_at_idx" ON "_fit_guides_v" USING btree ("version_updated_at");
  CREATE INDEX "_fit_guides_v_version_version_created_at_idx" ON "_fit_guides_v" USING btree ("version_created_at");
  CREATE INDEX "_fit_guides_v_version_version__status_idx" ON "_fit_guides_v" USING btree ("version__status");
  CREATE INDEX "_fit_guides_v_created_at_idx" ON "_fit_guides_v" USING btree ("created_at");
  CREATE INDEX "_fit_guides_v_updated_at_idx" ON "_fit_guides_v" USING btree ("updated_at");
  CREATE INDEX "_fit_guides_v_snapshot_idx" ON "_fit_guides_v" USING btree ("snapshot");
  CREATE INDEX "_fit_guides_v_published_locale_idx" ON "_fit_guides_v" USING btree ("published_locale");
  CREATE INDEX "_fit_guides_v_latest_idx" ON "_fit_guides_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_fit_guides_v_locales_locale_parent_id_unique" ON "_fit_guides_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "property_guides_tenant_idx" ON "property_guides" USING btree ("tenant_id");
  CREATE INDEX "property_guides_slug_idx" ON "property_guides" USING btree ("slug");
  CREATE INDEX "property_guides_cover_image_idx" ON "property_guides" USING btree ("cover_image_id");
  CREATE INDEX "property_guides_updated_at_idx" ON "property_guides" USING btree ("updated_at");
  CREATE INDEX "property_guides_created_at_idx" ON "property_guides" USING btree ("created_at");
  CREATE INDEX "property_guides__status_idx" ON "property_guides" USING btree ("_status");
  CREATE UNIQUE INDEX "property_guides_locales_locale_parent_id_unique" ON "property_guides_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_property_guides_v_parent_idx" ON "_property_guides_v" USING btree ("parent_id");
  CREATE INDEX "_property_guides_v_version_version_tenant_idx" ON "_property_guides_v" USING btree ("version_tenant_id");
  CREATE INDEX "_property_guides_v_version_version_slug_idx" ON "_property_guides_v" USING btree ("version_slug");
  CREATE INDEX "_property_guides_v_version_version_cover_image_idx" ON "_property_guides_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_property_guides_v_version_version_updated_at_idx" ON "_property_guides_v" USING btree ("version_updated_at");
  CREATE INDEX "_property_guides_v_version_version_created_at_idx" ON "_property_guides_v" USING btree ("version_created_at");
  CREATE INDEX "_property_guides_v_version_version__status_idx" ON "_property_guides_v" USING btree ("version__status");
  CREATE INDEX "_property_guides_v_created_at_idx" ON "_property_guides_v" USING btree ("created_at");
  CREATE INDEX "_property_guides_v_updated_at_idx" ON "_property_guides_v" USING btree ("updated_at");
  CREATE INDEX "_property_guides_v_snapshot_idx" ON "_property_guides_v" USING btree ("snapshot");
  CREATE INDEX "_property_guides_v_published_locale_idx" ON "_property_guides_v" USING btree ("published_locale");
  CREATE INDEX "_property_guides_v_latest_idx" ON "_property_guides_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_property_guides_v_locales_locale_parent_id_unique" ON "_property_guides_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "regulatory_notes_tenant_idx" ON "regulatory_notes" USING btree ("tenant_id");
  CREATE INDEX "regulatory_notes_slug_idx" ON "regulatory_notes" USING btree ("slug");
  CREATE INDEX "regulatory_notes_cover_image_idx" ON "regulatory_notes" USING btree ("cover_image_id");
  CREATE INDEX "regulatory_notes_updated_at_idx" ON "regulatory_notes" USING btree ("updated_at");
  CREATE INDEX "regulatory_notes_created_at_idx" ON "regulatory_notes" USING btree ("created_at");
  CREATE INDEX "regulatory_notes__status_idx" ON "regulatory_notes" USING btree ("_status");
  CREATE UNIQUE INDEX "regulatory_notes_locales_locale_parent_id_unique" ON "regulatory_notes_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_regulatory_notes_v_parent_idx" ON "_regulatory_notes_v" USING btree ("parent_id");
  CREATE INDEX "_regulatory_notes_v_version_version_tenant_idx" ON "_regulatory_notes_v" USING btree ("version_tenant_id");
  CREATE INDEX "_regulatory_notes_v_version_version_slug_idx" ON "_regulatory_notes_v" USING btree ("version_slug");
  CREATE INDEX "_regulatory_notes_v_version_version_cover_image_idx" ON "_regulatory_notes_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_regulatory_notes_v_version_version_updated_at_idx" ON "_regulatory_notes_v" USING btree ("version_updated_at");
  CREATE INDEX "_regulatory_notes_v_version_version_created_at_idx" ON "_regulatory_notes_v" USING btree ("version_created_at");
  CREATE INDEX "_regulatory_notes_v_version_version__status_idx" ON "_regulatory_notes_v" USING btree ("version__status");
  CREATE INDEX "_regulatory_notes_v_created_at_idx" ON "_regulatory_notes_v" USING btree ("created_at");
  CREATE INDEX "_regulatory_notes_v_updated_at_idx" ON "_regulatory_notes_v" USING btree ("updated_at");
  CREATE INDEX "_regulatory_notes_v_snapshot_idx" ON "_regulatory_notes_v" USING btree ("snapshot");
  CREATE INDEX "_regulatory_notes_v_published_locale_idx" ON "_regulatory_notes_v" USING btree ("published_locale");
  CREATE INDEX "_regulatory_notes_v_latest_idx" ON "_regulatory_notes_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_regulatory_notes_v_locales_locale_parent_id_unique" ON "_regulatory_notes_v_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_tenants_id_idx" ON "payload_locked_documents_rels" USING btree ("tenants_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_site_settings_id_idx" ON "payload_locked_documents_rels" USING btree ("site_settings_id");
  CREATE INDEX "payload_locked_documents_rels_case_studies_id_idx" ON "payload_locked_documents_rels" USING btree ("case_studies_id");
  CREATE INDEX "payload_locked_documents_rels_packaging_guides_id_idx" ON "payload_locked_documents_rels" USING btree ("packaging_guides_id");
  CREATE INDEX "payload_locked_documents_rels_fit_guides_id_idx" ON "payload_locked_documents_rels" USING btree ("fit_guides_id");
  CREATE INDEX "payload_locked_documents_rels_property_guides_id_idx" ON "payload_locked_documents_rels" USING btree ("property_guides_id");
  CREATE INDEX "payload_locked_documents_rels_regulatory_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("regulatory_notes_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_tenants" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "tenants" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "posts_tags" CASCADE;
  DROP TABLE "posts" CASCADE;
  DROP TABLE "posts_locales" CASCADE;
  DROP TABLE "_posts_v_version_tags" CASCADE;
  DROP TABLE "_posts_v" CASCADE;
  DROP TABLE "_posts_v_locales" CASCADE;
  DROP TABLE "site_settings_navigation" CASCADE;
  DROP TABLE "site_settings_navigation_locales" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "site_settings_locales" CASCADE;
  DROP TABLE "case_studies_services_delivered" CASCADE;
  DROP TABLE "case_studies" CASCADE;
  DROP TABLE "case_studies_locales" CASCADE;
  DROP TABLE "_case_studies_v_version_services_delivered" CASCADE;
  DROP TABLE "_case_studies_v" CASCADE;
  DROP TABLE "_case_studies_v_locales" CASCADE;
  DROP TABLE "packaging_guides_sectors" CASCADE;
  DROP TABLE "packaging_guides" CASCADE;
  DROP TABLE "packaging_guides_locales" CASCADE;
  DROP TABLE "_packaging_guides_v_version_sectors" CASCADE;
  DROP TABLE "_packaging_guides_v" CASCADE;
  DROP TABLE "_packaging_guides_v_locales" CASCADE;
  DROP TABLE "fit_guides_measurements" CASCADE;
  DROP TABLE "fit_guides_measurements_locales" CASCADE;
  DROP TABLE "fit_guides" CASCADE;
  DROP TABLE "fit_guides_locales" CASCADE;
  DROP TABLE "_fit_guides_v_version_measurements" CASCADE;
  DROP TABLE "_fit_guides_v_version_measurements_locales" CASCADE;
  DROP TABLE "_fit_guides_v" CASCADE;
  DROP TABLE "_fit_guides_v_locales" CASCADE;
  DROP TABLE "property_guides" CASCADE;
  DROP TABLE "property_guides_locales" CASCADE;
  DROP TABLE "_property_guides_v" CASCADE;
  DROP TABLE "_property_guides_v_locales" CASCADE;
  DROP TABLE "regulatory_notes" CASCADE;
  DROP TABLE "regulatory_notes_locales" CASCADE;
  DROP TABLE "_regulatory_notes_v" CASCADE;
  DROP TABLE "_regulatory_notes_v_locales" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_users_tenants_role";
  DROP TYPE "public"."enum_users_global_role";
  DROP TYPE "public"."enum_tenants_default_locale";
  DROP TYPE "public"."enum_posts_status";
  DROP TYPE "public"."enum__posts_v_version_status";
  DROP TYPE "public"."enum__posts_v_published_locale";
  DROP TYPE "public"."enum_site_settings_build_target";
  DROP TYPE "public"."enum_case_studies_client_disclosure";
  DROP TYPE "public"."enum_case_studies_status";
  DROP TYPE "public"."enum__case_studies_v_version_client_disclosure";
  DROP TYPE "public"."enum__case_studies_v_version_status";
  DROP TYPE "public"."enum__case_studies_v_published_locale";
  DROP TYPE "public"."enum_packaging_guides_material";
  DROP TYPE "public"."enum_packaging_guides_flute";
  DROP TYPE "public"."enum_packaging_guides_status";
  DROP TYPE "public"."enum__packaging_guides_v_version_material";
  DROP TYPE "public"."enum__packaging_guides_v_version_flute";
  DROP TYPE "public"."enum__packaging_guides_v_version_status";
  DROP TYPE "public"."enum__packaging_guides_v_published_locale";
  DROP TYPE "public"."enum_fit_guides_measurements_unit";
  DROP TYPE "public"."enum_fit_guides_status";
  DROP TYPE "public"."enum__fit_guides_v_version_measurements_unit";
  DROP TYPE "public"."enum__fit_guides_v_version_status";
  DROP TYPE "public"."enum__fit_guides_v_published_locale";
  DROP TYPE "public"."enum_property_guides_status";
  DROP TYPE "public"."enum__property_guides_v_version_status";
  DROP TYPE "public"."enum__property_guides_v_published_locale";
  DROP TYPE "public"."enum_regulatory_notes_status";
  DROP TYPE "public"."enum__regulatory_notes_v_version_status";
  DROP TYPE "public"."enum__regulatory_notes_v_published_locale";`)
}
