import { isBangladeshCricketNews } from "@/lib/news/bangladesh-filter";
import {
  NEWS_CRICBUZZ_LIVE_ARTICLE_FETCHES,
  NEWS_CRICBUZZ_LISTING_PAGES,
  NEWS_LIVE_REVALIDATE_SEC,
} from "@/lib/news/constants";
import { decodeHtmlEntities, fetchText } from "@/lib/news/http";
import {
  extractPublishDateFromHtml,
  resolvePublishDate,
} from "@/lib/news/publish-date";
import type { CricketNewsItem } from "@/lib/news/types";

const CRICBUZZ_BASE = "https://www.cricbuzz.com";

const SLUG_BD_HINT =
  /bangladesh|shanto|mushfiqur|litton|tamim|mahmudullah|mehidy|taijul|taskin|mustafizur|mirpur|sylhet|chattogram|zimbabwe-to-host-bangladesh/i;

function extractArticlePaths(html: string): string[] {
  const paths = new Set<string>();
  for (const match of html.matchAll(/href="(\/cricket-news\/\d+\/[^"]+)"/g)) {
    paths.add(match[1]);
  }
  return [...paths];
}

function newsIdFromPath(path: string): number {
  const id = path.match(/\/cricket-news\/(\d+)\//)?.[1];
  return id ? Number(id) : 0;
}

function slugToTitle(path: string): string {
  const slug = path.match(/\/cricket-news\/\d+\/(.+)$/)?.[1] ?? path;
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function slugFromPath(path: string): string {
  return path.match(/\/cricket-news\/\d+\/(.+)$/)?.[1] ?? path;
}

function extractListingPublishDates(html: string): Map<string, string> {
  const dates = new Map<string, string>();

  for (const chunk of html.split('{"@type":"NewsArticle"').slice(1)) {
    const slug = chunk.match(/"caption":"([^"]+)"/)?.[1];
    const datePublished = chunk.match(/"datePublished":"([^"]+)"/)?.[1];
    if (!slug || !datePublished) continue;

    dates.set(slug, resolvePublishDate([datePublished]));
  }

  return dates;
}

function parseOgMeta(html: string): {
  title?: string;
  description?: string;
  image?: string;
} {
  const pick = (prop: string) =>
    html.match(new RegExp(`property="og:${prop}" content="([^"]+)"`, "i"))?.[1];

  return {
    title: pick("title"),
    description: pick("description"),
    image: pick("image"),
  };
}

async function fetchArticleMeta(
  path: string,
  listingDates: Map<string, string>,
): Promise<CricketNewsItem | null> {
  const url = `${CRICBUZZ_BASE}${path}`;
  const html = await fetchText(url, { revalidate: NEWS_LIVE_REVALIDATE_SEC });
  const og = parseOgMeta(html);
  const title = og.title ? decodeHtmlEntities(og.title) : slugToTitle(path);
  const summary = og.description ? decodeHtmlEntities(og.description) : undefined;

  if (!isBangladeshCricketNews(title, summary ?? "")) return null;

  const id = path.match(/\/cricket-news\/(\d+)\//)?.[1] ?? path;
  const publishedAt = resolvePublishDate([
    extractPublishDateFromHtml(html) ?? undefined,
    listingDates.get(slugFromPath(path)),
  ]);

  return {
    id: `cricbuzz-${id}`,
    title,
    summary,
    url,
    imageUrl: og.image,
    source: "cricbuzz",
    publishedAt,
  };
}

function itemFromSlug(path: string, listingDates: Map<string, string>): CricketNewsItem | null {
  if (!SLUG_BD_HINT.test(path)) return null;

  const title = slugToTitle(path);
  if (!isBangladeshCricketNews(title)) return null;

  const id = path.match(/\/cricket-news\/(\d+)\//)?.[1] ?? path;

  return {
    id: `cricbuzz-${id}`,
    title,
    url: `${CRICBUZZ_BASE}${path}`,
    source: "cricbuzz",
    publishedAt: resolvePublishDate([listingDates.get(slugFromPath(path))]),
  };
}

/** Live path: 2 listing requests + up to 3 article pages (no paid API). */
export async function fetchCricbuzzBangladeshNewsLite(): Promise<CricketNewsItem[]> {
  const paths = new Set<string>();

  const listingDates = new Map<string, string>();

  for (const suffix of NEWS_CRICBUZZ_LISTING_PAGES) {
    const html = await fetchText(`${CRICBUZZ_BASE}/cricket-news${suffix}`, {
      revalidate: NEWS_LIVE_REVALIDATE_SEC,
    });
    for (const [slug, publishedAt] of extractListingPublishDates(html)) {
      listingDates.set(slug, publishedAt);
    }
    for (const p of extractArticlePaths(html)) paths.add(p);
  }

  const sorted = [...paths].sort((a, b) => newsIdFromPath(b) - newsIdFromPath(a));
  const items: CricketNewsItem[] = [];
  const seen = new Set<string>();
  let articleFetches = 0;

  for (const path of sorted) {
    if (items.length >= 12) break;
    if (seen.has(path)) continue;
    seen.add(path);

    const slugItem = itemFromSlug(path, listingDates);
    if (slugItem) {
      items.push(slugItem);
      continue;
    }

    if (articleFetches >= NEWS_CRICBUZZ_LIVE_ARTICLE_FETCHES) continue;

    try {
      const article = await fetchArticleMeta(path, listingDates);
      articleFetches += 1;
      if (article) items.push(article);
    } catch {
      // skip
    }
  }

  return items;
}
