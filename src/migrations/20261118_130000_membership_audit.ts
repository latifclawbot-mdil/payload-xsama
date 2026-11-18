import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Membership audit trail.
 *
 * Written by hand rather than generated: Payload's generator proposed renaming
 * existing columns (for example author_name → seo_title) because the local
 * artifact schema no longer matched production. A rename of live editorial
 * columns would destroy data, so this migration only creates the new objects.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_membership_audit_action" AS ENUM(
        'member_added', 'member_removed', 'role_changed', 'account_created', 'account_deleted'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_membership_audit_source" AS ENUM('admin', 'api', 'bootstrap');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "membership_audit" (
      "id" serial PRIMARY KEY NOT NULL,
      "summary" varchar NOT NULL,
      "action" "public"."enum_membership_audit_action" NOT NULL,
      "tenant_id" integer,
      "subject_id" integer,
      "subject_email" varchar,
      "previous_role" varchar,
      "new_role" varchar,
      "actor_id" integer,
      "actor_email" varchar,
      "source" "public"."enum_membership_audit_source" DEFAULT 'admin',
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "membership_audit"
      ADD CONSTRAINT "membership_audit_tenant_id_tenants_id_fk"
      FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;

    ALTER TABLE "membership_audit"
      ADD CONSTRAINT "membership_audit_subject_id_users_id_fk"
      FOREIGN KEY ("subject_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

    ALTER TABLE "membership_audit"
      ADD CONSTRAINT "membership_audit_actor_id_users_id_fk"
      FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "membership_audit_tenant_idx" ON "membership_audit" ("tenant_id");
    CREATE INDEX IF NOT EXISTS "membership_audit_action_idx" ON "membership_audit" ("action");
    CREATE INDEX IF NOT EXISTS "membership_audit_created_at_idx" ON "membership_audit" ("created_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "membership_audit" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_membership_audit_action";
    DROP TYPE IF EXISTS "public"."enum_membership_audit_source";
  `)
}
