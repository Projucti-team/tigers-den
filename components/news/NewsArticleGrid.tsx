import { NEWS_SOURCE_LABELS, formatNewsRelativeTime } from "@/lib/news/format";
import type { CricketNewsItem } from "@/lib/news/types";

type NewsArticleGridProps = {
  items: CricketNewsItem[];
};

export function NewsArticleGrid({ items }: NewsArticleGridProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-emerald/30 bg-white/80 p-10 text-center text-sm text-charcoal/60">
        No headlines right now — check back shortly.
      </p>
    );
  }

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id}>
          <article className="flex h-full flex-col overflow-hidden rounded-lg border-2 border-emerald/25 bg-white shadow-sm transition hover:border-emerald/50">
            {item.imageUrl ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-[16/9] overflow-hidden bg-charcoal/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </a>
            ) : (
              <div
                className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-emerald to-crimson text-4xl"
                aria-hidden
              >
                🐯
              </div>
            )}
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-emerald/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-emerald">
                  {NEWS_SOURCE_LABELS[item.source]}
                </span>
                <time
                  dateTime={item.publishedAt}
                  className="font-mono text-[10px] text-charcoal/45"
                >
                  {formatNewsRelativeTime(item.publishedAt)}
                </time>
              </div>
              <h2 className="mt-2 flex-1 font-display text-sm font-extrabold uppercase leading-snug text-charcoal">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald"
                >
                  {item.title}
                </a>
              </h2>
              {item.summary ? (
                <p className="mt-2 line-clamp-3 text-sm text-charcoal/70">{item.summary}</p>
              ) : null}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 text-xs font-extrabold uppercase text-crimson hover:underline"
              >
                Read on {NEWS_SOURCE_LABELS[item.source]} →
              </a>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
