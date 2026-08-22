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
  const highlight = await getMatchHighlight().catch((e) => {
    console.error("[cricket] marquee: getMatchHighlight failed:", e);
    return null;
  });
  const isLive = highlight?.mode === "live";

  let lastLine: string | null = null;
  try {
    if (highlight?.mode === "live") {
      lastLine = `LIVE · ${formatLiveMarqueeLine(highlight)}`;
    } else if (highlight) {
      lastLine = formatLastMatchMarqueeLine(highlight);
    }
  } catch (e) {
    console.error("[cricket] marquee: formatting the last/live line failed:", e, highlight);
  }

  // Real Bangladesh-team fixtures (men/women/u19/emerging) come from the DB, refreshed by the
  // "bangladesh-schedule" sync job; admin-tracked domestic fixtures still come from a live ESPN
  // league scan since there's no announced schedule for those to sync ahead of time the same way.
  // Each source is independently caught -- one feed failing (a bad date on a single domestic
  // fixture, say) used to reject the whole snapshot and silently drop the marquee to brand-only
  // items with no trace in the logs.
  const [bangladeshUpcoming, domesticUpcoming] = await Promise.all([
    getBangladeshUpcomingMatches(5).catch((e) => {
      console.error("[cricket] marquee: getBangladeshUpcomingMatches failed:", e);
      return [];
    }),
    fetchEspnUpcomingDomesticMatches(3).catch((e) => {
      console.error("[cricket] marquee: fetchEspnUpcomingDomesticMatches failed:", e);
      return [];
    }),
  ]);
  const upcoming = [...bangladeshUpcoming, ...domesticUpcoming].sort(
    (a, b) => matchTime(a) - matchTime(b),
  );
  const visibleUpcoming =
    isLive && highlight
      ? upcoming.filter((m) => !isUpcomingHiddenByLive(highlight, m))
      : upcoming;
  const upcomingLines: string[] = [];
  for (const m of visibleUpcoming.slice(0, MARQUEE_UPCOMING_LIMIT)) {
    try {
      upcomingLines.push(
        m.trackedPlayerName ? formatUpcomingDomesticMarqueeLine(m) : formatUpcomingMatchMarqueeLine(m),
      );
    } catch (e) {
      console.error("[cricket] marquee: formatting an upcoming line failed, skipping it:", e, m);
    }
  }

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
