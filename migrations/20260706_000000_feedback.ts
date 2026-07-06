import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "feedback" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "description" varchar NOT NULL,
      "category" varchar NOT NULL CHECK ("category" IN ('bug', 'feature', 'other')),
      "image_id" integer REFERENCES "media"("id") ON DELETE SET NULL,
      "page_url" varchar NOT NULL,
      "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "email" varchar,
      "name" varchar,
      "status" varchar NOT NULL DEFAULT 'new' CHECK ("status" IN ('new', 'under_review', 'ticket_raised', 'in_progress', 'resolved', 'dismissed')),
      "status_timeline" jsonb,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_feedback_status" ON "feedback" ("status");
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_feedback_created_at" ON "feedback" ("created_at");
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_feedback_user_id" ON "feedback" ("user_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "feedback"`);
}
