import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { migrations } from "../../migrations/index.ts";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Regression guard: migrations/20260706_000000_feedback.ts existed and was fully correct, but
 * was never imported/added to the `migrations` array in migrations/index.ts -- so it never
 * actually ran, and the "feedback" table never existed in production ("relation \"feedback\"
 * does not exist") despite the migration file being right there. Payload's migration runner
 * only executes what's registered in this array; a migration file sitting unregistered next to
 * it is silently a no-op forever. This test would have caught it: every *.ts file in
 * migrations/ (other than index.ts itself) must have a corresponding entry in the array.
 */
test("every migration file in migrations/ is registered in migrations/index.ts", () => {
  const migrationsDir = path.join(dirname, "..", "..", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts")
    .map((f) => f.replace(/\.ts$/, ""))
    .sort();

  const registeredNames = migrations.map((m) => m.name).sort();

  const unregistered = files.filter((f) => !registeredNames.includes(f));
  assert.deepEqual(
    unregistered,
    [],
    `Migration file(s) exist but aren't registered in migrations/index.ts: ${unregistered.join(", ")}`,
  );

  const missingFiles = registeredNames.filter((name) => !files.includes(name));
  assert.deepEqual(
    missingFiles,
    [],
    `migrations/index.ts registers migration(s) with no matching file: ${missingFiles.join(", ")}`,
  );
});
