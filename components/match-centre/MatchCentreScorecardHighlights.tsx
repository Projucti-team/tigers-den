import type { ReactNode } from "react";

import type {
  ScorecardAward,
  ScorecardExtras,
  ScorecardImpactPlayer,
  ScorecardRecordNote,
} from "@/lib/cricket/types";

function HighlightCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white/90 p-4 shadow-sm">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald">{title}</p>
      {children}
    </div>
  );
}

function PlayerLine({ name, team, detail }: { name: string; team?: string; detail?: string }) {
  return (
    <div>
      <p className="font-display text-base font-extrabold text-charcoal">
        {name}
        {team ? <span className="ml-2 text-sm font-bold text-charcoal/45">{team}</span> : null}
      </p>
      {detail ? <p className="mt-1 font-mono text-sm text-charcoal/70">{detail}</p> : null}
    </div>
  );
}

function ImpactLine({ player, label }: { player: ScorecardImpactPlayer; label?: string }) {
  const detail = [
    label ?? `${player.impactPoints} impact pts`,
    player.battingImpact != null ? `Bat ${player.battingImpact}` : null,
    player.bowlingImpact != null ? `Bowl ${player.bowlingImpact}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return <PlayerLine name={player.name} team={player.team} detail={detail} />;
}

function AwardBlock({ award }: { award: ScorecardAward }) {
  return <PlayerLine name={award.name} team={award.team} detail={award.summary} />;
}

function RecordsList({ records }: { records: ScorecardRecordNote[] }) {
  return (
    <ul className="space-y-2 text-sm text-charcoal/80">
      {records.map((record, index) => (
        <li key={`${record.text}-${index}`} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" aria-hidden />
          <span>{record.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function MatchCentreScorecardHighlights({ extras }: { extras: ScorecardExtras }) {
  const cards: ReactNode[] = [];

  if (extras.manOfTheMatch) {
    cards.push(
      <HighlightCard key="motm" title="Player of the Match">
        <AwardBlock award={extras.manOfTheMatch} />
      </HighlightCard>,
    );
  }

  if (extras.mvp) {
    cards.push(
      <HighlightCard key="mvp" title="Cricinfo MVP">
        <ImpactLine player={extras.mvp} />
      </HighlightCard>,
    );
  }

  if (extras.topBangladeshPlayer) {
    const sameAsMvp =
      extras.mvp &&
      extras.mvp.name === extras.topBangladeshPlayer.name &&
      extras.mvp.impactPoints === extras.topBangladeshPlayer.impactPoints;

    if (!sameAsMvp) {
      cards.push(
        <HighlightCard key="top-ban" title="Top Tiger (Match Impact)">
          <ImpactLine player={extras.topBangladeshPlayer} />
        </HighlightCard>,
      );
    }
  }

  if (extras.records.length) {
    cards.push(
      <HighlightCard key="records" title="Records & Milestones">
        <RecordsList records={extras.records} />
      </HighlightCard>,
    );
  }

  if (!cards.length) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((card) => card)}
    </div>
  );
}
