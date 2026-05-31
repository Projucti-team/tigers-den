/**
 * Seed cricket snapshots on the live deployment before static pages are generated.
 * Safe to skip on first deploy (no URL yet) or when CRON_SECRET is unset.
 */
function resolveBootstrapUrl(): string | null {
  const fromEnv =
    process.env.DEPLOY_BOOTSTRAP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SERVER_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined);

  if (!fromEnv) return null;
  return fromEnv.replace(/\/$/, "");
}

async function main() {
  if (
    !process.env.POSTGRES_URL?.trim() &&
    !process.env.DATABASE_URL?.trim() &&
    !process.env.DATABASE_URI?.trim()
  ) {
    console.log("[deploy:seed] No database env — skipping.");
    return;
  }

  const base = resolveBootstrapUrl();
  if (!base) {
    console.log("[deploy:seed] No production URL — skipping (first deploy or set NEXT_PUBLIC_SITE_URL).");
    return;
  }

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.warn("[deploy:seed] CRON_SECRET not set — skipping remote seed.");
    return;
  }

  const url = `${base}/api/admin/bootstrap-db?forceCricketSync=1`;
  console.log(`[deploy:seed] POST ${url}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      console.warn("[deploy:seed] bootstrap returned", res.status, body);
      return;
    }

    console.log("[deploy:seed] ok:", JSON.stringify(body));
  } catch (err) {
    console.warn(
      "[deploy:seed] request failed (build continues):",
      err instanceof Error ? err.message : err,
    );
  }
}

main().catch((err) => {
  console.error("[deploy:seed] fatal:", err);
  process.exit(1);
});
