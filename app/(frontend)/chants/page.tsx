import { NewsArticleGrid } from "@/components/news/NewsArticleGrid";
import { PageHero } from "@/components/pages/PageHero";
import { getBangladeshCricketNews } from "@/lib/news/services/bangladesh-news";

export const metadata = {
  title: "Latest news — The Tigers' Den",
  description:
    "Latest Bangladesh cricket headlines from ESPN Cricinfo, Cricbuzz, bdnews24, and The Daily Star.",
};

export default async function ChantsPage() {
  const news = await getBangladeshCricketNews();

  return (
    <>
      <PageHero
        label="Bangladesh cricket"
        title="Latest news"
        subtitle="Headlines about the Tigers — refreshed throughout the day from ESPN Cricinfo, Cricbuzz, bdnews24, and The Daily Star."
      />
      <div className="mx-auto max-w-[1440px] px-4 py-10 md:px-8 md:py-14">
        {news.live ? (
          <p className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-emerald">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
            </span>
            Live feed
          </p>
        ) : null}
        {news.stale && !news.live ? (
          <p className="mb-8 text-xs font-semibold text-charcoal/50">
            Feed may be out of date — run{" "}
            <code className="font-mono">npm run scrape:bangladesh-news</code> to refresh.
          </p>
        ) : null}

        <NewsArticleGrid items={news.items} />

        {news.fetchedAt ? (
          <p className="mt-10 text-center font-mono text-[10px] text-charcoal/40">
            Last updated {new Date(news.fetchedAt).toLocaleString("en-GB")}
          </p>
        ) : null}
      </div>
    </>
  );
}
