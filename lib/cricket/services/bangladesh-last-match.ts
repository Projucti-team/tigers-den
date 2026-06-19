import {
  fetchEspnLiveBangladeshHighlight,
  fetchEspnRecentBangladeshHighlight,
} from "@/lib/cricket/providers/espn-live";
import {
  readBangladeshLastMatch,
  writeBangladeshLastMatch,
  type BangladeshLastMatchSnapshot,
} from "@/lib/cricket/bangladesh-match-store";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import { readCricketSnapshot, upsertCricketSnapshot } from "@/lib/cricket/snapshot-db";
import { isPayloadConfigured } from "@/lib/payload-env";
import type { MatchHighlight } from "@/lib/cricket/services/match-highlight";

/** Refresh cache from ESPNcricinfo — run via sync job (not on every page view). */
export async function scrapeBangladeshLastMatch(): Promise<BangladeshLastMatchSnapshot | null> {
  const recent = await fetchEspnRecentBangladeshHighlight().catch(() => null);

  if (!recent) {
    return readBangladeshLastMatch();
  }

  await persistBangladeshLastMatchHighlight(recent, "espn");
  return {
    fetchedAt: new Date().toISOString(),
    source: "espn",
    highlight: recent,
  };
}

export async function getCachedBangladeshLastMatch(): Promise<MatchHighlight | null> {
  if (isPayloadConfigured()) {
    const cached = await readCricketSnapshot<BangladeshLastMatchSnapshot>(
      CRICKET_SNAPSHOT_KEYS.lastMatch,
    );
    if (cached?.highlight) return cached.highlight;
  }

  const file = await readBangladeshLastMatch();
  return file?.highlight ?? null;
}

/** Persist a fresh last-match highlight after full time. */
export async function persistBangladeshLastMatchHighlight(
  highlight: MatchHighlight,
  source = "espn",
): Promise<void> {
  const snapshot: BangladeshLastMatchSnapshot = {
    fetchedAt: new Date().toISOString(),
    source,
    highlight,
  };

  await writeBangladeshLastMatch(snapshot);

  if (isPayloadConfigured()) {
    await upsertCricketSnapshot(
      CRICKET_SNAPSHOT_KEYS.lastMatch,
      "Bangladesh last completed match",
      snapshot,
    );
  }
}

/** ESPN completed result first, then nightly cache. */
export async function getRecentBangladeshMatchHighlight(): Promise<MatchHighlight | null> {
  const espnRecent = await fetchEspnRecentBangladeshHighlight().catch(() => null);
  const cached = await getCachedBangladeshLastMatch();

  if (espnRecent) {
    if (!cached || cached.matchId !== espnRecent.matchId) {
      void persistBangladeshLastMatchHighlight(espnRecent).catch(() => {});
    }
    return espnRecent;
  }

  return cached;
}

/** Live scores from ESPNcricinfo only. */
export async function getLiveBangladeshHighlight(): Promise<MatchHighlight | null> {
  return fetchEspnLiveBangladeshHighlight().catch(() => null);
}
