import { isBangladeshCricketNews } from "@/lib/news/bangladesh-filter";
import { NEWS_LIVE_REVALIDATE_SEC } from "@/lib/news/constants";
import { decodeHtmlEntities, fetchText } from "@/lib/news/http";
import type { CricketNewsItem } from "@/lib/news/types";

const ESPN_RSS_URL = "https://www.espncricinfo.com/rss/content/story/feeds/0.xml";

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function parseRssItems(xml: string): Array<{
  title: string;
  description: string;
  link: string;
  guid: string;
  pubDate: string;
  imageUrl?: string;
}> {
  const items: Array<{
    title: string;
    description: string;
    link: string;
    guid: string;
    pubDate: string;
    imageUrl?: string;
  }> = [];

  const itemBlocks = xml.split(/<item>/i).slice(1);
  for (const block of itemBlocks) {
    const title = block.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
    const description = block.match(/<description>([^<]*)<\/description>/i)?.[1]?.trim() ?? "";
    const link =
      block.match(/<url>([^<]*)<\/url>/i)?.[1]?.trim() ||
      block.match(/<link>([^<]*)<\/link>/i)?.[1]?.trim();
    const guid = block.match(/<guid>([^<]*)<\/guid>/i)?.[1]?.trim() ?? link ?? "";
    const pubDate = block.match(/<pubDate>([^<]*)<\/pubDate>/i)?.[1]?.trim() ?? "";
    const imageUrl =
      block.match(/<coverImages>([^<]*)<\/coverImages>/i)?.[1]?.trim() ||
      block.match(/url="([^"]+)"[^>]*medium="image"/i)?.[1]?.trim();

    if (!title || !link) continue;
    items.push({ title, description, link, guid, pubDate, imageUrl });
  }

  return items;
}

export async function fetchEspnCricinfoBangladeshNews(options?: {
  revalidate?: number;
}): Promise<CricketNewsItem[]> {
  const revalidate = options?.revalidate ?? NEWS_LIVE_REVALIDATE_SEC;
  const xml = await fetchText(
    ESPN_RSS_URL,
    revalidate === 0 ? { cache: "no-store" } : { revalidate },
  );
  const parsed = parseRssItems(xml);

  return parsed
    .filter((item) =>
      isBangladeshCricketNews(item.title, stripTags(item.description)),
    )
    .map((item) => {
      const publishedAt = item.pubDate
        ? new Date(item.pubDate).toISOString()
        : new Date().toISOString();
      const cleanLink = item.link.split("?")[0] ?? item.link;

      return {
        id: `espn-${item.guid || cleanLink}`,
        title: decodeHtmlEntities(item.title),
        summary: stripTags(item.description) || undefined,
        url: cleanLink,
        imageUrl: item.imageUrl?.replace(/^http:/, "https:"),
        source: "espncricinfo" as const,
        publishedAt,
      };
    });
}
