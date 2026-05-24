import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import { readCricketSnapshot, staleSnapshotWarning } from "@/lib/cricket/snapshot-db";
import type { RankingsShowcaseSnapshot } from "@/lib/cricket/snapshot-types";

export type {
  FormatShowcase,
  RankingsShowcase,
  WtcShowcase,
} from "@/lib/cricket/services/build-rankings-showcase";

const emptyShowcase = (gender: "men" | "women") => ({
  gender,
  formats: [],
  warnings: [] as string[],
});

/** Read pre-built rankings from DB (nightly cron). */
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
  const stale = staleSnapshotWarning(cached.fetchedAt, "Rankings");
  if (stale) warnings.push(stale);

  return { ...cached, warnings };
}
