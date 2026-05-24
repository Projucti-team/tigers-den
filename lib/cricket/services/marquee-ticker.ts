import { getCachedBangladeshLastMatch, getLiveBangladeshHighlight } from "@/lib/cricket/services/bangladesh-last-match";
import { getCachedUpcomingBangladeshMatches } from "@/lib/cricket/services/bangladesh-upcoming-matches";
import {
  formatLastMatchMarqueeLine,
  formatUpcomingMatchMarqueeLine,
} from "@/lib/cricket/services/marquee-format";

const BRAND_ITEMS = [
  "🐅 THE TIGERS' DEN",
  "🇧🇩 GREEN & RED ARMY",
  "🔥 ROAR FOR BANGLADESH",
] as const;

export async function getMarqueeTickerItems(): Promise<string[]> {
  const live = await getLiveBangladeshHighlight();
  const completed = live ? null : await getCachedBangladeshLastMatch();

  let lastLine: string | null = null;
  if (live) {
    lastLine = `LIVE · ${formatLastMatchMarqueeLine(live)}`;
  } else if (completed) {
    lastLine = formatLastMatchMarqueeLine(completed);
  }

  const upcoming = await getCachedUpcomingBangladeshMatches();
  const upcomingLines = upcoming.map((m) => formatUpcomingMatchMarqueeLine(m));

  const dynamic: string[] = [];
  if (lastLine) dynamic.push(`🏏 ${lastLine}`);
  for (const line of upcomingLines) {
    dynamic.push(`📅 ${line}`);
  }

  return [...BRAND_ITEMS, ...dynamic];
}
