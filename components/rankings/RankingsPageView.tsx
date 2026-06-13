import type { ReactNode } from "react";

import {
  TeamStandingsTable,
  TigersPlayerList,
  WtcStandingsTable,
  rankDateSubtitle,
} from "@/components/rankings/RankingsUi";
import type { FormatShowcase, RankingsShowcase } from "@/lib/cricket/services/rankings-display";
import type { WtcShowcase } from "@/lib/cricket/services/wtc";
import type { CricketFormat } from "@/lib/cricket/types";

type Props = {
  men: RankingsShowcase;
  women: RankingsShowcase;
  wtc?: WtcShowcase | null;
  warnings?: string[];
};

const FORMAT_OVERALL_LABEL: Record<CricketFormat, string> = {
  test: "Test Overall Ranking",
  odi: "ODI Overall Ranking",
  t20: "T20 Overall Ranking",
};

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center">
      <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-white md:text-2xl">
        {title}
      </h3>
      {subtitle ? <p className="mt-1 text-sm text-white/65">{subtitle}</p> : null}
    </div>
  );
}

function VibrantPanel({ children }: { children: ReactNode }) {
  return (
    <div className="fan-vibrant-card rounded-2xl border-4 border-amber/50 p-5 md:p-8">{children}</div>
  );
}

function FormatBlock({ format }: { format: FormatShowcase }) {
  const teamUpdated = rankDateSubtitle(format.rankUpdatedAt.team);
  const batUpdated = rankDateSubtitle(format.rankUpdatedAt.bat);
  const bowlUpdated = rankDateSubtitle(format.rankUpdatedAt.bowl);
  const arUpdated = rankDateSubtitle(format.rankUpdatedAt.allrounder);

  return (
    <div className="space-y-6">
      <SectionHeading
        title={FORMAT_OVERALL_LABEL[format.format]}
        subtitle={teamUpdated ? `ICC top 10 teams · ${teamUpdated}` : "ICC top 10 teams"}
      />
      <VibrantPanel>
        <TeamStandingsTable teams={format.topTeams ?? []} formatLabel={format.label} />
      </VibrantPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3">
          <p className="text-center font-display text-xs font-extrabold uppercase tracking-widest text-emerald">
            Top Bangladeshi Batters
          </p>
          {batUpdated ? (
            <p className="text-center text-[11px] font-semibold text-white/55">{batUpdated}</p>
          ) : null}
          <VibrantPanel>
            <TigersPlayerList
              players={format.bangladeshBatters ?? []}
              role="Batter"
              accent="green"
            />
          </VibrantPanel>
        </div>
        <div className="space-y-3">
          <p className="text-center font-display text-xs font-extrabold uppercase tracking-widest text-crimson">
            Top Bangladeshi Bowlers
          </p>
          {bowlUpdated ? (
            <p className="text-center text-[11px] font-semibold text-white/55">{bowlUpdated}</p>
          ) : null}
          <VibrantPanel>
            <TigersPlayerList
              players={format.bangladeshBowlers ?? []}
              role="Bowler"
              accent="red"
            />
          </VibrantPanel>
        </div>
        <div className="space-y-3">
          <p className="text-center font-display text-xs font-extrabold uppercase tracking-widest fan-gradient-text">
            Top Bangladeshi All-rounders
          </p>
          {arUpdated ? (
            <p className="text-center text-[11px] font-semibold text-white/55">{arUpdated}</p>
          ) : null}
          <VibrantPanel>
            <TigersPlayerList
              players={format.bangladeshAllRounders ?? []}
              role="All-Rounder"
              accent="amber"
            />
          </VibrantPanel>
        </div>
      </div>
    </div>
  );
}

function GenderRankingsBlock({
  showcase,
  title,
  wtc,
}: {
  showcase: RankingsShowcase;
  title: string;
  wtc?: WtcShowcase | null;
}) {
  return (
    <div className="space-y-12">
      <SectionHeading
        title={title}
        subtitle="ICC team standings and Bangladesh players in the top 100"
      />

      {wtc ? (
        <div className="space-y-6">
          <SectionHeading
            title="WTC Overall Ranking"
            subtitle={`World Test Championship · ${wtc.cycleLabel}`}
          />
          <VibrantPanel>
            <WtcStandingsTable
              standings={wtc.topStandings ?? wtc.standings.slice(0, 10)}
              cycleLabel={wtc.cycleLabel}
            />
          </VibrantPanel>
        </div>
      ) : null}

      {showcase.formats.map((format) => (
        <FormatBlock key={format.format} format={format} />
      ))}
    </div>
  );
}

export function RankingsPageView({ men, women, wtc = null, warnings = [] }: Props) {
  return (
    <section className="border-y-4 border-amber/80 py-14 md:py-20">
      <div className="mx-auto max-w-[1440px] space-y-20 px-4 md:px-8">
        <GenderRankingsBlock showcase={men} title="Men's Rankings" wtc={wtc} />
        <GenderRankingsBlock showcase={women} title="Women's Rankings" />

        {warnings.length > 0 ? (
          <div className="rounded-lg border-2 border-amber/40 bg-amber/15 px-4 py-3 text-center text-xs font-semibold text-amber">
            {warnings[0]}
            {warnings.length > 1 ? ` (+${warnings.length - 1} more)` : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
