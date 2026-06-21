import type { ReactNode } from "react";

import { MatchCentreScorecardHighlights } from "@/components/match-centre/MatchCentreScorecardHighlights";
import type { Scorecard, ScorecardPlayer } from "@/lib/cricket/types";

type Props = {
  scorecard: Scorecard | null;
};

function stat(value: number | string | undefined, digits?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  if (typeof value === "number" && digits != null) return value.toFixed(digits);
  return String(value);
}

const BATTING_COLS = ["w-[34%]", "w-[13.2%]", "w-[13.2%]", "w-[13.2%]", "w-[13.2%]", "w-[13.2%]"];
const BOWLING_COLS = ["w-[38%]", "w-[15.5%]", "w-[15.5%]", "w-[15.5%]", "w-[15.5%]"];

function ScorecardTable({
  headers,
  rows,
  colWidths,
}: {
  headers: string[];
  rows: ReactNode[][];
  colWidths: string[];
}) {
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-charcoal/10 bg-white">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} className={w} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-charcoal/10 bg-charcoal/5 text-xs font-bold uppercase text-charcoal/60">
            {headers.map((h, i) => (
              <th key={h} className={`px-2 py-2 ${i === 0 ? "text-left" : "text-center"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-charcoal/5 last:border-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-2 py-2.5 ${
                    j === 0 ? "text-left" : "text-center font-mono tabular-nums text-charcoal/80"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatterCell({ player }: { player: ScorecardPlayer }) {
  const notOut = Boolean(player.dismissed && /not out/i.test(player.dismissed));

  return (
    <div className="flex items-start justify-between gap-3">
      <span className="font-semibold text-charcoal">{player.name}</span>
      {player.dismissed ? (
        <span
          className={`max-w-[58%] shrink-0 text-right text-xs leading-snug ${
            notOut ? "font-medium text-emerald" : "text-charcoal/55"
          }`}
        >
          {player.dismissed}
        </span>
      ) : null}
    </div>
  );
}

function battingRows(players: ScorecardPlayer[]) {
  return players.map((p) => [
    <BatterCell key={p.name} player={p} />,
    stat(p.runs),
    stat(p.balls),
    stat(p.fours),
    stat(p.sixes),
    stat(p.sr, 2),
  ]);
}

function bowlingRows(players: ScorecardPlayer[]) {
  return players.map((p) => [
    <span key={p.name} className="font-semibold text-charcoal">
      {p.name}
    </span>,
    stat(p.overs),
    stat(p.runs),
    stat(p.wickets),
    stat(p.economy, 2),
  ]);
}

function InningsBlock({ inning }: { inning: Scorecard["innings"][number] }) {
  const hasBatting = inning.batting.length > 0;
  const hasBowling = inning.bowling.length > 0;

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white/80 p-4 shadow-sm md:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-charcoal/10 pb-3">
        <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-charcoal">
          {inning.inning}
        </h3>
        <p className="font-mono text-xl font-bold text-emerald">
          {inning.runs}/{inning.wickets}
          {inning.overs > 0 ? (
            <span className="text-sm font-semibold text-charcoal/60"> ({inning.overs} ov)</span>
          ) : null}
        </p>
      </div>

      {hasBatting ? (
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-charcoal/50">Batting</p>
          <ScorecardTable
            headers={["Batter", "R", "B", "4s", "6s", "SR"]}
            colWidths={BATTING_COLS}
            rows={battingRows(inning.batting)}
          />
        </div>
      ) : (
        <p className="mb-4 text-sm text-charcoal/50">Batting card not available for this innings yet.</p>
      )}

      {hasBowling ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-charcoal/50">Bowling</p>
          <ScorecardTable
            headers={["Bowler", "O", "R", "W", "Econ"]}
            colWidths={BOWLING_COLS}
            rows={bowlingRows(inning.bowling)}
          />
        </div>
      ) : null}
    </div>
  );
}

export function MatchCentreScorecardTab({ scorecard }: Props) {
  if (!scorecard?.innings.length) {
    return (
      <p className="py-8 text-center text-sm text-charcoal/60">
        Full scorecard will appear once innings data is available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {scorecard.venue ? (
        <p className="text-sm font-semibold text-charcoal/60">{scorecard.venue}</p>
      ) : null}
      {scorecard.extras ? <MatchCentreScorecardHighlights extras={scorecard.extras} /> : null}
      {scorecard.innings.map((inn) => (
        <InningsBlock key={inn.inning} inning={inn} />
      ))}
    </div>
  );
}
