import { ExperienceCards } from "@/components/home/ExperienceCards";
import { HeroPromo } from "@/components/home/HeroPromo";
import { HomeCommunitySection } from "@/components/home/HomeCommunitySection";
// import { HomeToursSection } from "@/components/home/HomeToursSection";
import { IccRankingsShowcase } from "@/components/home/IccRankingsShowcase";
import { LiveMatchStrip } from "@/components/home/LiveMatchStrip";
import { NewsFeed } from "@/components/home/NewsFeed";
import { MerchSection } from "@/components/home/MerchSection";
// import { WhyJoinSection } from "@/components/home/WhyJoinSection";
import { FORMATS_BY_GENDER } from "@/lib/cricket/constants";
import { getMatchHighlight, getRankingsShowcase, getTourCards } from "@/lib/cricket";
import { getBangladeshCricketNews } from "@/lib/news/services/bangladesh-news";
import type { CricketFormat } from "@/lib/cricket/types";
import { formatThreadFromPost, isSlideVisible } from "@/lib/data";
import { getPayloadClient } from "@/lib/payload";
import type { HeroSlide, Media, Post } from "@/payload-types";
import type { RankingsShowcase } from "@/lib/cricket/services/rankings-display";

/** CMS hero + forum threads must not be frozen at build time. */
export const dynamic = "force-dynamic";

async function getHomeContent() {
  try {
    const payload = await getPayloadClient();

    const [slidesResult, postsResult] = await Promise.all([
      payload.find({
        collection: "hero-slides",
        where: { isActive: { equals: true } },
        sort: "sortOrder",
        limit: 5,
        depth: 2,
      }),
      payload.find({
        collection: "posts",
        where: { status: { equals: "published" } },
        sort: "-publishedAt",
        limit: 10,
        depth: 1,
      }),
    ]);

    const sorted = (slidesResult.docs as HeroSlide[])
      .filter((s) => isSlideVisible(s))
      .sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0),
      );

    const slides: HeroSlide[] = await Promise.all(
      sorted.map(async (slide) => {
        if (typeof slide.image !== "number") return slide;
        const image = (await payload.findByID({
          collection: "media",
          id: slide.image,
          depth: 0,
        })) as Media;
        return { ...slide, image };
      }),
    );
    const threads = (postsResult.docs as Post[])
      .filter((p) => p.pinned)
      .map(formatThreadFromPost);

    return { slides, threads };
  } catch {
    return { slides: [] as HeroSlide[], threads: [] };
  }
}

const FORMAT_LABELS: Record<CricketFormat, string> = {
  test: "Test",
  odi: "ODI",
  t20: "T20I",
};

const emptyShowcase = (gender: "men" | "women"): RankingsShowcase => ({
  gender,
  formats: FORMATS_BY_GENDER[gender].map((format) => ({
    format,
    label: FORMAT_LABELS[format],
    bangladeshRank: null,
    bangladeshRating: null,
    topBatsman: null,
    topBowler: null,
    topAllRounder: null,
  })),
  warnings: [],
});

export default async function HomePage() {
  const [{ slides, threads }, rankings, toursResult, matchHighlight, news] = await Promise.all([
    getHomeContent(),
    getRankingsShowcase().catch(() => ({
      men: emptyShowcase("men"),
      women: emptyShowcase("women"),
      wtc: null,
      warnings: ["ICC rankings unavailable. Run npm run scrape:icc-rankings to refresh data/icc-rankings.json."],
    })),
    getTourCards(3).catch(() => ({
      cards: [],
      featuredAway: null,
      warnings: [] as string[],
    })),
    getMatchHighlight().catch(() => null),
    getBangladeshCricketNews().catch(() => ({
      items: [],
      fetchedAt: null,
      stale: true,
      live: false,
    })),
  ]);

  return (
    <>
      <HeroPromo slides={slides} />
      <IccRankingsShowcase
        men={rankings.men}
        women={rankings.women}
        wtc={rankings.wtc}
        warnings={rankings.warnings}
      />
      <ExperienceCards
        featuredAwayTour={toursResult.featuredAway}
        hasLiveMatch={matchHighlight?.mode === "live"}
        hasRecentMatch={matchHighlight?.mode === "completed"}
      />
      {/* <HomeToursSection tours={toursResult.cards} /> */}
      <LiveMatchStrip highlight={matchHighlight} />
      <NewsFeed
        items={news.items}
        fetchedAt={news.fetchedAt}
        stale={news.stale}
        live={news.live}
      />
      <section
        id="tickets"
        className="scroll-mt-24 border-y-4 border-amber/80 py-14 text-center md:scroll-mt-28 md:py-20"
      >
        <div className="mx-auto max-w-[1440px] px-4 md:px-8">
          <p className="fan-section-label mx-auto text-amber">Match day</p>
          <h2 className="mt-4 font-display text-3xl font-extrabold uppercase text-white md:text-5xl">
            Be part of the biggest moments{" "}
            <span className="text-emerald-glow">this summer!</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/80 md:text-lg">
            Secure cricket tickets for Bangladesh&apos;s 2026 internationals — Mirpur, Chattogram,
            Sylhet and overseas tours with The Tigers&apos; Den.
          </p>
          <a href="/tours" className="fan-btn-amber mt-8 inline-block rounded px-10 py-4 text-sm">
            Bangladesh Cricket Tickets
          </a>
        </div>
      </section>
      <HomeCommunitySection threads={threads.length > 0 ? threads : undefined} />
      <MerchSection />
    </>
  );
}
