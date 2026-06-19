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

/** Read pre-built rankings from DB; rebuild automatically when the snapshot schema is outdated. */
export async function getRankingsShowcase(): Promise<RankingsShowcaseSnapshot> {
  const cached = await readCricketSnapshot<RankingsShowcaseSnapshot>(
    CRICKET_SNAPSHOT_KEYS.rankingsShowcase,
  );

  if (needsRankingsShowcaseRebuild(cached)) {
    try {
      const rebuilt = await refreshRankingsShowcase();
      const warnings = [...rebuilt.warnings];
      if (cached) {
        warnings.push("Rankings snapshot upgraded to the latest layout (top 10 teams + Tigers in top 100).");
      }
      return { ...rebuilt, warnings };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rankings rebuild failed";
      if (cached) {
        const warnings = [...(cached.warnings ?? []), message];
        return { ...cached, warnings };
      }
      return {
        fetchedAt: new Date(0).toISOString(),
        men: emptyShowcase("men"),
        women: emptyShowcase("women"),
        wtc: null,
        warnings: [
          message,
          "Run `npm run sync:cricket` or trigger /api/cron/cricket on production.",
        ],
      };
    }
  }

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
  const stale = staleSnapshotWarning(cached.fetchedAt, "Rankings");
  if (stale) warnings.push(stale);

  return { ...cached, warnings };
}

export { logRankingsShowcaseStats, needsRankingsShowcaseRebuild };
