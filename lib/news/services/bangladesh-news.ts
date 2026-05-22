import { unstable_cache } from "next/cache";

import { NEWS_DISPLAY_LIMIT, NEWS_LIVE_REVALIDATE_SEC } from "@/lib/news/constants";
import { fetchCricbuzzBangladeshNewsLite } from "@/lib/news/providers/cricbuzz-lite";
import { fetchCricbuzzBangladeshNews } from "@/lib/news/providers/cricbuzz-scrape";
import { fetchEspnCricinfoBangladeshNews } from "@/lib/news/providers/espncricinfo-rss";
import {
  readBangladeshCricketNews,
  writeBangladeshCricketNews,
} from "@/lib/news/news-store";
import type { BangladeshCricketNewsSnapshot, CricketNewsItem } from "@/lib/news/types";

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.href.replace(/\/$/, "");
  } catch {
    return url.split("?")[0] ?? url;
  }
}

function mergeNewsItems(items: CricketNewsItem[]): CricketNewsItem[] {
  const byUrl = new Map<string, CricketNewsItem>();

  for (const item of items) {
    const key = normalizeUrl(item.url);
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, item);
      continue;
    }

    const preferNew =
      Boolean(item.imageUrl && !existing.imageUrl) ||
      Boolean(item.summary && !existing.summary) ||
      new Date(item.publishedAt) > new Date(existing.publishedAt);

    if (preferNew) byUrl.set(key, { ...existing, ...item });
  }

  return [...byUrl.values()].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

async function fetchLiveBangladeshNews(): Promise<{
  items: CricketNewsItem[];
  fetchedAt: string;
  live: boolean;
  stale: boolean;
}> {
  const [espn, cricbuzzLite, fileCache] = await Promise.all([
    fetchEspnCricinfoBangladeshNews(),
    fetchCricbuzzBangladeshNewsLite().catch(() => [] as CricketNewsItem[]),
    readBangladeshCricketNews(),
  ]);

  const fileItems = fileCache?.items ?? [];
  const items = mergeNewsItems([...espn, ...cricbuzzLite, ...fileItems]).slice(
    0,
    NEWS_DISPLAY_LIMIT,
  );

  return {
    items,
    fetchedAt: new Date().toISOString(),
    live: true,
    stale: items.length === 0,
  };
}

const getCachedLiveNews = unstable_cache(
  fetchLiveBangladeshNews,
  ["bangladesh-cricket-news-live"],
  { revalidate: NEWS_LIVE_REVALIDATE_SEC, tags: ["bangladesh-cricket-news"] },
);

/** Nightly / manual — full Cricbuzz scrape; not used on page load. */
export async function scrapeBangladeshCricketNews(): Promise<BangladeshCricketNewsSnapshot> {
  const [espn, cricbuzz] = await Promise.all([
    fetchEspnCricinfoBangladeshNews({ revalidate: 0 }).catch(() => [] as CricketNewsItem[]),
    fetchCricbuzzBangladeshNews().catch(() => [] as CricketNewsItem[]),
  ]);

  const items = mergeNewsItems([...espn, ...cricbuzz]);

  const snapshot: BangladeshCricketNewsSnapshot = {
    fetchedAt: new Date().toISOString(),
    items,
  };

  if (items.length > 0) {
    await writeBangladeshCricketNews(snapshot);
  }

  return snapshot;
}

/** Home page — ESPN RSS + light Cricbuzz, cached 15 min (no paid API). */
export async function getBangladeshCricketNews(): Promise<{
  items: CricketNewsItem[];
  fetchedAt: string | null;
  stale: boolean;
  live: boolean;
}> {
  try {
    const result = await getCachedLiveNews();
    if (result.items.length > 0) return result;
  } catch {
    // fall through to file cache
  }

  const snapshot = await readBangladeshCricketNews();
  if (!snapshot?.items.length) {
    return { items: [], fetchedAt: null, stale: true, live: false };
  }

  const ageHours =
    (Date.now() - new Date(snapshot.fetchedAt).getTime()) / (1000 * 60 * 60);

  return {
    items: snapshot.items.slice(0, NEWS_DISPLAY_LIMIT),
    fetchedAt: snapshot.fetchedAt,
    stale: ageHours > 36,
    live: false,
  };
}
