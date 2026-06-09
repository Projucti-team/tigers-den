import { getMatchHighlight } from "@/lib/cricket/services/match-highlight";
import { getCachedUpcomingBangladeshMatches } from "@/lib/cricket/services/bangladesh-upcoming-matches";
import {
  formatLastMatchMarqueeLine,
  formatLiveMarqueeLine,
  formatUpcomingMatchMarqueeLine,
  isUpcomingHiddenByLive,
} from "@/lib/cricket/services/marquee-format";

const BRAND_ITEMS = [
  "🐅 THE TIGERS' DEN",
  "🇧🇩 GREEN & RED ARMY",
  "🔥 ROAR FOR BANGLADESH",
] as const;

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

  const upcoming = await getCachedUpcomingBangladeshMatches();
  const visibleUpcoming =
    isLive && highlight
      ? upcoming.filter((m) => !isUpcomingHiddenByLive(highlight, m))
      : upcoming;
  const upcomingLines = visibleUpcoming.map((m) => formatUpcomingMatchMarqueeLine(m));

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
