/**
 * During Vercel production builds, seed cricket snapshots before static pages are generated.
 * SQL migrations run earlier via `npm run deploy:migrate` (no Payload CLI).
 */
export async function register() {
  if (process.env.NEXT_PHASE !== "phase-production-build") return;
  if (!process.env.POSTGRES_URL?.trim() && !process.env.DATABASE_URL?.trim()) return;
  if (!process.env.PAYLOAD_SECRET?.trim()) return;

  const { runDeployBootstrap } = await import("@/lib/deploy/bootstrap");
  console.log("[instrumentation] Running deploy bootstrap before static generation…");
  const result = await runDeployBootstrap();

  console.log("[instrumentation] bootstrap:", JSON.stringify(result));
  if (result.migrations === "skipped" && result.errors.some((e) => e.includes("Schema migration failed"))) {
    throw new Error(result.errors.join("; "));
  }
}
