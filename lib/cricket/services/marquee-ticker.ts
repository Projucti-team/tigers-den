import { getMatchHighlight, matchTime } from "@/lib/cricket/services/match-highlight";
import { getBangladeshUpcomingMatches } from "@/lib/cricket/services/bangladesh-schedule-read";
import { fetchEspnUpcomingDomesticMatches } from "@/lib/cricket/providers/espn-live";
import {
  formatLastMatchMarqueeLine,
  formatLiveMarqueeLine,
  formatUpcomingMatchMarqueeLine,
  isUpcomingHiddenByLive,
} from "@/lib/cricket/services/marquee-format";
import { formatUpcomingDomesticMarqueeLine } from "@/lib/cricket/services/marquee-domestic-format";

const BRAND_ITEMS = [
  "🐅 THE TIGERS' DEN",
  "🇧🇩 GREEN & RED ARMY",
  "🔥 ROAR FOR BANGLADESH",
] as const;

/** Top marquee only ever teases the next few fixtures, not the whole cached lookahead. */
const MARQUEE_UPCOMING_LIMIT = 3;

export type MarqueeTickerSnapshot = {
  items: string[];
  isLive: boolean;
};

export async function getMarqueeTickerSnapshot(): Promise<MarqueeTickerSnapshot> {
  const highlight = await getMatchHighlight();
  const isLive = highlight?.mode === "live";

  let lastLine: string | null = null;
  if (highlight?.mode === "live") {
    lastLine = `LIVE · ${formatLiveMarqueeLine(highlight)}`;
  } else if (highlight) {
    lastLine = formatLastMatchMarqueeLine(highlight);
  }

  // Real Bangladesh-team fixtures (men/women/u19/emerging) come from the DB, refreshed by the
  // "bangladesh-schedule" sync job; admin-tracked domestic fixtures still come from a live ESPN
  // league scan since there's no announced schedule for those to sync ahead of time the same way.
  const [bangladeshUpcoming, domesticUpcoming] = await Promise.all([
    getBangladeshUpcomingMatches(5),
    fetchEspnUpcomingDomesticMatches(3).catch(() => []),
  ]);
  const upcoming = [...bangladeshUpcoming, ...domesticUpcoming].sort(
    (a, b) => matchTime(a) - matchTime(b),
  );
  const visibleUpcoming =
    isLive && highlight
      ? upcoming.filter((m) => !isUpcomingHiddenByLive(highlight, m))
      : upcoming;
  const upcomingLines = visibleUpcoming
    .slice(0, MARQUEE_UPCOMING_LIMIT)
    .map((m) => (m.trackedPlayerName ? formatUpcomingDomesticMarqueeLine(m) : formatUpcomingMatchMarqueeLine(m)));

  const dynamic: string[] = [];
  if (lastLine) dynamic.push(`🏏 ${lastLine}`);
  for (const line of upcomingLines) {
    dynamic.push(`📅 ${line}`);
  }

  return { items: [...BRAND_ITEMS, ...dynamic], isLive };
}

export async function getMarqueeTickerItems(): Promise<string[]> {
  const { items } = await getMarqueeTickerSnapshot();
  return items;
}
