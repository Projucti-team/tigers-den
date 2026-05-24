import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-vercel-postgres";
import { sql } from "drizzle-orm";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "cricket_snapshots" (
      "id" serial PRIMARY KEY NOT NULL,
      "key" varchar NOT NULL,
      "label" varchar NOT NULL,
      "fetched_at" timestamp(3) with time zone NOT NULL,
      "data" jsonb NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "cricket_snapshots_key_idx"
    ON "cricket_snapshots" USING btree ("key");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "cricket_snapshots_updated_at_idx"
    ON "cricket_snapshots" USING btree ("updated_at");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "cricket_snapshots_created_at_idx"
    ON "cricket_snapshots" USING btree ("created_at");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "cricket_snapshots" CASCADE;`);
}
