/**
 * Triggers /api/cron/cricket (runs inside Next.js where Payload DB access works).
 * On Vercel, cron hits that route at 21:00 UTC (= 3:00 AM BDT). Other nightly jobs run 3:15–3:45 AM BDT.
 *
 * Local: start `npm run dev` first, then `npm run sync:cricket`
 *
 * Usage: npm run sync:cricket [-- --force]
 *   --force re-fetches CricAPI even if the tours snapshot is younger than 24h.
 */
async function main() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  const force = process.argv.includes("--force");
  const url = `${base}/api/cron/cricket${force ? "?force=1" : ""}`;

  console.log(`Triggering cricket sync at ${url} …`);

  const headers: Record<string, string> = {};
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const res = await fetch(url, { method: "POST", headers, cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    console.error("Sync failed:", body);
    process.exit(1);
  }

  console.log(JSON.stringify(body, null, 2));
}

main().catch((err) => {
  console.error(err);
  console.error(
    "\nTip: start the dev server (`npm run dev`) before running sync locally, or deploy and use Vercel cron.",
  );
  process.exit(1);
});
