/** Next.js fetch / unstable_cache TTL — keeps outbound requests low (free tier). */
export const NEWS_LIVE_REVALIDATE_SEC = 15 * 60;

/** Cricbuzz listing pages per live refresh (2 HTTP requests). */
export const NEWS_CRICBUZZ_LISTING_PAGES = ["", "/1"] as const;

/** Max per-article Cricbuzz fetches on live path (og metadata). */
export const NEWS_CRICBUZZ_LIVE_ARTICLE_FETCHES = 3;

/** Max per-article bdnews24 fetches on live path (og metadata). */
export const NEWS_BDNEWS24_LIVE_ARTICLE_FETCHES = 3;

/** Full scrape only in npm run scrape:bangladesh-news (CI nightly). */
export const NEWS_CRICBUZZ_SCRAPE_LISTING_PAGES = 9;

export const NEWS_DISPLAY_LIMIT = 16;
