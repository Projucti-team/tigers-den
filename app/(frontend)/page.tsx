import { ExperienceCards } from "@/components/home/ExperienceCards";
import { HeroPromo } from "@/components/home/HeroPromo";
import { HomeCommunitySection } from "@/components/home/HomeCommunitySection";
import { HomeToursSection } from "@/components/home/HomeToursSection";
import { IccRankingsShowcase } from "@/components/home/IccRankingsShowcase";
import { LiveMatchStrip } from "@/components/home/LiveMatchStrip";
import { NewsFeed } from "@/components/home/NewsFeed";
// import { MembershipSection } from "@/components/home/MembershipSection";
import { MerchSection } from "@/components/home/MerchSection";
import { NewsletterSignup } from "@/components/home/NewsletterSignup";
// import { WhyJoinSection } from "@/components/home/WhyJoinSection";
import { FORMATS_BY_GENDER } from "@/lib/cricket/constants";
import { getMatchHighlight, getRankingsShowcase, getTourCards } from "@/lib/cricket";
import { getBangladeshCricketNews } from "@/lib/news/services/bangladesh-news";
import type { CricketFormat } from "@/lib/cricket/types";
import { formatThreadFromPost, isSlideVisible } from "@/lib/data";
import { getPayloadClient } from "@/lib/payload";
import type { HeroSlide, Post } from "@/payload-types";
import type { RankingsShowcase } from "@/lib/cricket/services/rankings-display";

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

    const slides = (slidesResult.docs as HeroSlide[])
      .filter((s) => isSlideVisible(s))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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
      <LiveMatchStrip highlight={matchHighlight} />
      <NewsFeed
        items={news.items}
        fetchedAt={news.fetchedAt}
        stale={news.stale}
        live={news.live}
      />
      <section id="tickets" className="bg-emerald py-12 text-center text-white md:py-16">
        <div className="mx-auto max-w-[1440px] px-4 md:px-8">
          <h2 className="font-display text-2xl font-extrabold uppercase md:text-4xl">
            Be part of the biggest moments this summer!
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/90">
            Secure cricket tickets for Bangladesh&apos;s 2026 internationals — Mirpur, Chattogram,
            Sylhet and overseas tours with The Tigers&apos; Den.
          </p>
          <a
            href="#tours"
            className="mt-6 inline-block rounded bg-crimson px-8 py-4 font-display text-sm font-extrabold uppercase tracking-wide hover:bg-crimson-bright"
          >
            Bangladesh Cricket Tickets
          </a>
        </div>
      </section>
      <HomeToursSection tours={toursResult.cards} />
      {/* <MembershipSection /> */}
      {/* <WhyJoinSection /> */}
      <HomeCommunitySection threads={threads.length > 0 ? threads : undefined} />
      <MerchSection />
      <NewsletterSignup />
    </>
  );
}
