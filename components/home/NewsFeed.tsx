import { NewsFeedCarousel } from "@/components/home/NewsFeedCarousel";
import type { CricketNewsItem } from "@/lib/news/types";

type Props = {
  items: CricketNewsItem[];
  fetchedAt: string | null;
  stale?: boolean;
  live?: boolean;
};

export function NewsFeed({ items, fetchedAt, stale, live }: Props) {
  if (items.length === 0) return null;

  return (
    <section id="news" className="fan-section-vibrant border-y-4 border-emerald/20 py-14 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <div className="text-center">
          <h2 className="font-display text-2xl font-extrabold uppercase md:text-3xl">
            <span className="fan-gradient-text">Tigers in the headlines</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-charcoal/75">
            Bangladesh cricket news from ESPN Cricinfo and Cricbuzz
            {live ? " — refreshes every 15 minutes." : " — updated from cache."}
          </p>
          {live && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-emerald">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
              </span>
              Live feed
            </p>
          )}
          {stale && !live && (
            <p className="mt-2 text-xs font-semibold text-charcoal/45">
              Feed may be out of date. Run{" "}
              <code className="font-mono">npm run scrape:bangladesh-news</code> to refresh.
            </p>
          )}
        </div>

        <div className="md:px-10">
          <NewsFeedCarousel items={items} />
        </div>

        {fetchedAt && (
          <p className="mt-8 text-center font-mono text-[10px] text-charcoal/40">
            Last updated {new Date(fetchedAt).toLocaleString("en-GB")}
          </p>
        )}
      </div>
    </section>
  );
}
