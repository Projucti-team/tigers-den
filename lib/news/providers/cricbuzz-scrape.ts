import { isBangladeshCricketNews } from "@/lib/news/bangladesh-filter";
import { NEWS_CRICBUZZ_SCRAPE_LISTING_PAGES } from "@/lib/news/constants";
import { decodeHtmlEntities, fetchText, sleep } from "@/lib/news/http";
import type { CricketNewsItem } from "@/lib/news/types";

const CRICBUZZ_BASE = "https://www.cricbuzz.com";
const LISTING_PAGES = Array.from(
  { length: NEWS_CRICBUZZ_SCRAPE_LISTING_PAGES },
  (_, i) => (i === 0 ? "" : `/${i}`),
);

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

async function fetchCricbuzzArticle(path: string): Promise<CricketNewsItem | null> {
  const url = `${CRICBUZZ_BASE}${path}`;
  const html = await fetchText(url, { cache: "no-store" });
  const og = parseOgMeta(html);

  if (!og.title) return null;

  const summary = og.description ? decodeHtmlEntities(og.description) : undefined;
  const title = decodeHtmlEntities(og.title);

  if (!isBangladeshCricketNews(title, summary ?? "")) return null;

  const id = path.match(/\/cricket-news\/(\d+)\//)?.[1] ?? path;

  return {
    id: `cricbuzz-${id}`,
    title,
    summary,
    url,
    imageUrl: og.image,
    source: "cricbuzz",
    publishedAt: new Date().toISOString(),
  };
}

export async function fetchCricbuzzBangladeshNews(): Promise<CricketNewsItem[]> {
  const paths = new Set<string>();

  for (const suffix of LISTING_PAGES) {
    const html = await fetchText(`${CRICBUZZ_BASE}/cricket-news${suffix}`, {
      cache: "no-store",
    });
    for (const p of extractArticlePaths(html)) paths.add(p);
  }

  const sorted = [...paths].sort((a, b) => newsIdFromPath(b) - newsIdFromPath(a));
  const items: CricketNewsItem[] = [];
  const seen = new Set<string>();

  for (const path of sorted) {
    if (items.length >= 20) break;
    if (seen.has(path)) continue;
    seen.add(path);

    try {
      const article = await fetchCricbuzzArticle(path);
      if (article) items.push(article);
    } catch {
      // skip failed article fetches
    }

    await sleep(120);
  }

  return items;
}
