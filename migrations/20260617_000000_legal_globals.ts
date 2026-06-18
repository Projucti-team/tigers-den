import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "privacy_policy" (
      "id" serial PRIMARY KEY NOT NULL,
      "subtitle" varchar NOT NULL,
      "last_updated" timestamp(3) with time zone NOT NULL,
      "content" jsonb NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "terms_of_service" (
      "id" serial PRIMARY KEY NOT NULL,
      "subtitle" varchar NOT NULL,
      "last_updated" timestamp(3) with time zone NOT NULL,
      "content" jsonb NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "terms_of_service";`);
  await db.execute(sql`DROP TABLE IF EXISTS "privacy_policy";`);
}
