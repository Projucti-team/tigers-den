import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import {
  buildRankingsShowcaseLive,
  logRankingsShowcaseStats,
  needsRankingsShowcaseRebuild,
} from "@/lib/cricket/services/build-rankings-showcase";
import { readCricketSnapshot, staleSnapshotWarning, upsertCricketSnapshot } from "@/lib/cricket/snapshot-db";
import type { RankingsShowcaseSnapshot } from "@/lib/cricket/snapshot-types";
import { isPayloadConfigured } from "@/lib/payload-env";

export type {
  FormatShowcase,
  RankingsShowcase,
  WtcShowcase,
} from "@/lib/cricket/services/build-rankings-showcase";
export {
  emptyFormatShowcase,
  emptyRankingsShowcase,
} from "@/lib/cricket/services/build-rankings-showcase";

const emptyShowcase = (gender: "men" | "women") => ({
  gender,
  formats: [],
  warnings: [] as string[],
});

async function persistRankingsShowcase(snapshot: RankingsShowcaseSnapshot): Promise<void> {
  if (!isPayloadConfigured()) return;
  await upsertCricketSnapshot(
    CRICKET_SNAPSHOT_KEYS.rankingsShowcase,
    "ICC rankings showcase",
    snapshot,
  );
}

/** Rebuild from ICC + WTC sources and store in Postgres when configured. */
export async function refreshRankingsShowcase(): Promise<RankingsShowcaseSnapshot> {
  const snapshot = await buildRankingsShowcaseLive();
  await persistRankingsShowcase(snapshot);
  return snapshot;
}

/**
 * Read pre-built rankings from DB -- never rebuilds live on the request path. A live rebuild
 * only ever happens via the nightly rankings cron job or deploy bootstrap (see
 * lib/deploy/bootstrap.ts), so an outdated/missing snapshot here just gets a warning instead
 * of blocking the page (this used to call refreshRankingsShowcase() synchronously whenever the
 * snapshot's schema version was outdated, which made every visitor pay for a live ICC+WTC
 * rebuild until the next cron run caught up).
 */
export async function getRankingsShowcase(): Promise<RankingsShowcaseSnapshot> {
  const cached = await readCricketSnapshot<RankingsShowcaseSnapshot>(
    CRICKET_SNAPSHOT_KEYS.rankingsShowcase,
  );

  if (!cached) {
    return {
      fetchedAt: new Date(0).toISOString(),
      men: emptyShowcase("men"),
      women: emptyShowcase("women"),
      wtc: null,
      warnings: [
        "Rankings not loaded yet. Run `npm run sync:cricket` or wait for the nightly refresh (~3:00 AM BDT).",
      ],
    };
  }

  const warnings = [...cached.warnings];
  if (needsRankingsShowcaseRebuild(cached)) {
    warnings.push(
      "Rankings snapshot is on an older layout version -- will refresh at the next scheduled sync.",
    );
  }
  const stale = staleSnapshotWarning(cached.fetchedAt, "Rankings");
  if (stale) warnings.push(stale);

  return { ...cached, warnings };
}

export { logRankingsShowcaseStats, needsRankingsShowcaseRebuild };
