import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "stand_discussions" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "excerpt" varchar,
      "body" varchar NOT NULL,
      "category" varchar DEFAULT 'general',
      "author_id" integer NOT NULL,
      "status" varchar DEFAULT 'draft' NOT NULL,
      "published_at" timestamp(3) with time zone,
      "pinned" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "stand_discussions_slug_idx"
    ON "stand_discussions" USING btree ("slug");
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "chants" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "lyrics" varchar NOT NULL,
      "author_id" integer NOT NULL,
      "status" varchar DEFAULT 'pending' NOT NULL,
      "featured_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "stand_reactions" (
      "id" serial PRIMARY KEY NOT NULL,
      "target_type" varchar NOT NULL,
      "target_id" numeric NOT NULL,
      "member_id" integer NOT NULL,
      "reaction" varchar NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "stand_reactions_target_idx"
    ON "stand_reactions" USING btree ("target_type", "target_id");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "stand_reactions_member_idx"
    ON "stand_reactions" USING btree ("member_id");
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "stand_comments" (
      "id" serial PRIMARY KEY NOT NULL,
      "target_type" varchar NOT NULL,
      "target_id" numeric NOT NULL,
      "author_id" integer NOT NULL,
      "body" varchar NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "stand_comments_target_idx"
    ON "stand_comments" USING btree ("target_type", "target_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "stand_comments"`);
  await db.execute(sql`DROP TABLE IF EXISTS "stand_reactions"`);
  await db.execute(sql`DROP TABLE IF EXISTS "chants"`);
  await db.execute(sql`DROP TABLE IF EXISTS "stand_discussions"`);
}
