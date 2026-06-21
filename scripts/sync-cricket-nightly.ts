/**
 * Triggers /api/cron/cricket (runs inside Next.js where Payload DB access works).
 * On Coolify/server cron, schedule this route at 21:00 UTC (= 3:00 AM BDT).
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
  const query = force ? "?force=1" : "";
  const url = `${base}/api/cron/cricket${query}`;

  console.log(`Triggering cricket sync at ${url} …`);

  const headers: Record<string, string> = {};
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const res = await fetch(url, { method: "POST", headers, cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok && res.status !== 202) {
    console.error("Sync failed:", body);
    process.exit(1);
  }

  console.log(JSON.stringify(body, null, 2));

  if (res.status === 202) {
    console.log("Waiting for background sync to finish…");
    const deadline = Date.now() + 10 * 60 * 1000;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const statusRes = await fetch(`${url}${query ? "&" : "?"}status=1`, { headers, cache: "no-store" });
      const lock = (await statusRes.json().catch(() => ({}))) as {
        inProgress?: boolean;
        lastResult?: Record<string, unknown>;
        lastError?: string | null;
      };

      if (lock.inProgress) {
        console.log("… still running");
        continue;
      }

      if (lock.lastError) {
        console.error("Sync failed:", lock.lastError);
        process.exit(1);
      }

      if (lock.lastResult) {
        console.log(JSON.stringify(lock.lastResult, null, 2));
        process.exit(lock.lastResult.ok === false ? 1 : 0);
      }
    }

    console.error("Sync did not finish within 10 minutes.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  console.error(
    "\nTip: start the dev server (`npm run dev`) before running sync locally, or deploy and use a Coolify/server cron.",
  );
  process.exit(1);
});
