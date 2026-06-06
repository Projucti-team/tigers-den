import { isBangladeshCricketNews } from "@/lib/news/bangladesh-filter";
import { NEWS_LIVE_REVALIDATE_SEC } from "@/lib/news/constants";
import { fetchText } from "@/lib/news/http";
import { parseRssItems } from "@/lib/news/providers/rss-parse";
import { resolvePublishDate } from "@/lib/news/publish-date";
import type { CricketNewsItem } from "@/lib/news/types";

const DAILY_STAR_CRICKET_RSS_URL =
  "https://www.thedailystar.net/sports/cricket/rss.xml";

export async function fetchDailyStarBangladeshNews(options?: {
  revalidate?: number;
}): Promise<CricketNewsItem[]> {
  const revalidate = options?.revalidate ?? NEWS_LIVE_REVALIDATE_SEC;
  const xml = await fetchText(
    DAILY_STAR_CRICKET_RSS_URL,
    revalidate === 0 ? { cache: "no-store" } : { revalidate },
  );
  const parsed = parseRssItems(xml);

  return parsed
    .filter((item) => isBangladeshCricketNews(item.title, item.description))
    .map((item) => {
      const publishedAt = resolvePublishDate([item.pubDate]);
      const cleanLink = item.link.split("?")[0] ?? item.link;
      const slug = cleanLink.match(/\/([^/]+)$/)?.[1] ?? cleanLink;

      return {
        id: `dailystar-${item.guid || slug}`,
        title: item.title,
        summary: item.description || undefined,
        url: cleanLink,
        imageUrl: item.imageUrl?.replace(/^http:/, "https:"),
        source: "dailystar" as const,
        publishedAt,
      };
    });
}
