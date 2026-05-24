import Link from "next/link";

import { IccRankingsShowcase } from "@/components/home/IccRankingsShowcase";
import { PageHero } from "@/components/pages/PageHero";
import { FORMATS_BY_GENDER } from "@/lib/cricket/constants";
import { getRankingsShowcase } from "@/lib/cricket";
import type { CricketFormat } from "@/lib/cricket/types";
import type { RankingsShowcase } from "@/lib/cricket/services/rankings-display";

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

export const metadata = {
  title: "ICC Rankings — The Tigers' Den",
  description: "ICC team and player rankings for Bangladesh and the world — Test, ODI, T20I and WTC.",
};

export default async function RankingsPage() {
  const rankings = await getRankingsShowcase().catch(() => ({
    men: emptyShowcase("men"),
    women: emptyShowcase("women"),
    wtc: null,
    warnings: ["ICC rankings unavailable. Run npm run scrape:icc-rankings to refresh data/icc-rankings.json."],
  }));

  return (
    <>
      <PageHero
        label="ICC Rankings"
        title="World rankings"
        subtitle="Team standings, top players, Bangladesh highlights, and World Test Championship points — updated from ICC data."
      />
      <div className="mx-auto max-w-[1440px] px-4 pb-4 pt-2 md:px-8">
        <Link href="/" className="text-xs font-bold uppercase text-emerald hover:text-crimson">
          ← Home
        </Link>
      </div>
      <IccRankingsShowcase
        men={rankings.men}
        women={rankings.women}
        wtc={rankings.wtc}
        warnings={rankings.warnings}
      />
    </>
  );
}
