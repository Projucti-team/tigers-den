import { isBangladeshCricketNews } from "@/lib/news/bangladesh-filter";
import {
  NEWS_BDNEWS24_LIVE_ARTICLE_FETCHES,
  NEWS_LIVE_REVALIDATE_SEC,
} from "@/lib/news/constants";
import { decodeHtmlEntities, fetchText } from "@/lib/news/http";
import {
  extractPublishDateFromHtml,
  resolvePublishDate,
} from "@/lib/news/publish-date";
import type { CricketNewsItem } from "@/lib/news/types";

const BDNEWS24_CRICKET_URL = "https://bdnews24.com/cricket";

type ListingArticle = {
  url: string;
  title: string;
  summary?: string;
  imageUrl?: string;
};

function extractListingArticles(html: string): ListingArticle[] {
  const articles: ListingArticle[] = [];
  const seen = new Set<string>();

  const blocks = html.split(/href="https:\/\/bdnews24\.com\/cricket\//i).slice(1);
  for (const block of blocks) {
    const id = block.match(/^([a-f0-9]+)"/i)?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const url = `https://bdnews24.com/cricket/${id}`;
    const title =
      block.match(/<h1>\s*([\s\S]*?)\s*<\/h1>/i)?.[1] ||
      block.match(/<h5>\s*([\s\S]*?)\s*<\/h5>/i)?.[1] ||
      block.match(/title="([^"]+)"/i)?.[1] ||
      block.match(/alt="([^"]+)"/i)?.[1];

    if (!title) continue;

    const summary = block.match(/<p>\s*([\s\S]*?)\s*<\/p>/i)?.[1];
    const imageUrl = block.match(/src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)?.[1];

    articles.push({
      url,
      title: decodeHtmlEntities(stripTags(title)),
      summary: summary ? decodeHtmlEntities(stripTags(summary)) : undefined,
      imageUrl,
    });
  }

  return articles;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

async function enrichArticle(
  article: ListingArticle,
  revalidate = NEWS_LIVE_REVALIDATE_SEC,
): Promise<CricketNewsItem | null> {
  const html = await fetchText(
    article.url,
    revalidate === 0 ? { cache: "no-store" } : { revalidate },
  );
  const og = parseOgMeta(html);
  const title = decodeHtmlEntities(og.title ?? article.title);
  const summary = decodeHtmlEntities(og.description ?? article.summary ?? "");

  if (!isBangladeshCricketNews(title, summary)) return null;

  const slug = article.url.match(/\/([a-f0-9]+)$/)?.[1] ?? article.url;
  const publishedAt = resolvePublishDate([extractPublishDateFromHtml(html) ?? undefined]);

  return {
    id: `bdnews24-${slug}`,
    title,
    summary: summary || undefined,
    url: article.url,
    imageUrl: (og.image ?? article.imageUrl)?.replace(/^http:/, "https:"),
    source: "bdnews24",
    publishedAt,
  };
}

/** Live path: one listing request + optional article pages for metadata. */
export async function fetchBdnews24BangladeshNewsLite(): Promise<CricketNewsItem[]> {
  const html = await fetchText(BDNEWS24_CRICKET_URL, {
    revalidate: NEWS_LIVE_REVALIDATE_SEC,
  });
  const listing = extractListingArticles(html);
  const items: CricketNewsItem[] = [];
  const seen = new Set<string>();
  let articleFetches = 0;

  for (const article of listing) {
    if (items.length >= 12) break;
    if (seen.has(article.url)) continue;
    seen.add(article.url);

    if (!isBangladeshCricketNews(article.title, article.summary ?? "")) continue;
    if (articleFetches >= NEWS_BDNEWS24_LIVE_ARTICLE_FETCHES) continue;

    try {
      const enriched = await enrichArticle(article, NEWS_LIVE_REVALIDATE_SEC);
      articleFetches += 1;
      if (enriched) items.push(enriched);
    } catch {
      // skip
    }
  }

  return items;
}

/** Nightly scrape — fetches og metadata for every listing link. */
export async function fetchBdnews24BangladeshNews(options?: {
  revalidate?: number;
}): Promise<CricketNewsItem[]> {
  const revalidate = options?.revalidate ?? 0;
  const html = await fetchText(
    BDNEWS24_CRICKET_URL,
    revalidate === 0 ? { cache: "no-store" } : { revalidate },
  );
  const listing = extractListingArticles(html);
  const items: CricketNewsItem[] = [];

  for (const article of listing) {
    if (!isBangladeshCricketNews(article.title, article.summary ?? "")) continue;

    try {
      const item = await enrichArticle(article, revalidate);
      if (item) items.push(item);
    } catch {
      // skip
    }
  }

  return items;
}
