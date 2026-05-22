/**
 * Updates data/bangladesh-cricket-news.json from ESPN Cricinfo RSS + Cricbuzz.
 * Run nightly — not on every page load.
 *
 * Usage: npm run scrape:bangladesh-news
 */
import { scrapeBangladeshCricketNews } from "../lib/news/services/bangladesh-news";
import { BANGLADESH_CRICKET_NEWS_PATH } from "../lib/news/news-store";

async function main() {
  console.log("Fetching Bangladesh cricket news from ESPN Cricinfo + Cricbuzz…");
  const snapshot = await scrapeBangladeshCricketNews();

  if (!snapshot.items.length) {
    console.log("No articles found. Existing cache kept (if any).");
    process.exit(1);
  }

  const bySource = snapshot.items.reduce(
    (acc, item) => {
      acc[item.source] = (acc[item.source] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log(`Saved ${snapshot.items.length} articles to ${BANGLADESH_CRICKET_NEWS_PATH}`);
  console.log(`  Sources: ${JSON.stringify(bySource)}`);
  console.log(`  Latest: ${snapshot.items[0]?.title}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
