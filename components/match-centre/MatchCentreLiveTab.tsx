import { ordinalSuffix } from "@/lib/cricket/ordinal";
import type { LiveMatchFeed, Scorecard } from "@/lib/cricket/types";

type Props = {
  feed: LiveMatchFeed | null;
  scorecard?: Scorecard | null;
};

function currentInningsLine(scorecard: Scorecard | null): string | null {
  if (!scorecard?.innings?.length) return null;
  const current = [...scorecard.innings]
    .reverse()
    .find((inn) => inn.runs > 0 || inn.wickets > 0 || inn.overs > 0);
  if (!current) return null;
  const team = current.inning.replace(/\s+\d+(?:st|nd|rd|th)\s+Innings$/i, "").trim();
  return `${team} ${current.runs}/${current.wickets} (${current.overs} ov)`;
}

const STAT_HEADERS = ["", "R", "B", "4s", "6s", "SR"] as const;

function LiveStatsTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: readonly string[];
  rows: (string | number | undefined)[][];
}) {
  if (!rows.length) return null;

  return (
    <div>
      <h3 className="mb-2 font-display text-xs font-extrabold uppercase tracking-wider text-charcoal/70">
        {title}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-charcoal/10 bg-white">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[38%]" />
            <col className="w-[12.4%]" />
            <col className="w-[12.4%]" />
            <col className="w-[12.4%]" />
            <col className="w-[12.4%]" />
            <col className="w-[12.4%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-charcoal/10 bg-charcoal/5 text-xs font-bold uppercase text-charcoal/60">
              {headers.map((h, i) => (
                <th key={`${title}-${h}-${i}`} className={`px-2 py-2 ${i === 0 ? "text-left" : "text-center"}`}>
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
                      j === 0
                        ? "truncate font-semibold text-charcoal"
                        : "text-center font-mono tabular-nums text-charcoal/80"
                    }`}
                  >
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BallChip({ label, isWicket }: { label: string; isWicket: boolean }) {
  const isDot = label === "•";
  const isBoundary = label === "4" || label === "6";

  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs font-bold ${
        isWicket
          ? "border-crimson bg-crimson text-white"
          : isBoundary
            ? "border-emerald bg-emerald/15 text-emerald"
            : isDot
              ? "border-charcoal/15 bg-charcoal/5 text-charcoal/50"
              : "border-charcoal/15 bg-white text-charcoal"
      }`}
    >
      {label}
    </span>
  );
}

function overLabel(overNumber: number): string {
  return `${overNumber}${ordinalSuffix(overNumber).toUpperCase()}`;
}

export function MatchCentreLiveTab({ feed, scorecard = null }: Props) {
  if (!feed) {
    return (
      <p className="py-8 text-center text-sm text-charcoal/60">
        Live player stats will appear when the match is in progress.
      </p>
    );
  }

  const inningsLine = currentInningsLine(scorecard);

  const batterRows = feed.batters.map((p) => [
    p.name,
    p.runs,
    p.balls,
    p.fours,
    p.sixes,
    p.sr?.toFixed(2),
  ]);

  const bowlerRows = feed.bowlers.map((p) => [
    p.name,
    p.overs,
    p.maidens ?? 0,
    p.runs,
    p.wickets,
    p.economy?.toFixed(2),
  ]);

  return (
    <div className="space-y-5">
      {inningsLine ? (
        <p className="rounded-lg border-2 border-emerald/30 bg-emerald/10 px-4 py-3 font-display text-lg font-extrabold uppercase tracking-tight text-emerald">
          {inningsLine}
        </p>
      ) : null}

      <LiveStatsTable title="Batters" headers={STAT_HEADERS} rows={batterRows} />

      <LiveStatsTable
        title="Bowlers"
        headers={["", "O", "M", "R", "W", "Econ"]}
        rows={bowlerRows}
      />

      {(feed.partnership || feed.lastWicket) && (
        <div className="space-y-1 rounded-lg border border-emerald/20 bg-emerald/5 px-3 py-2 text-sm text-charcoal/80">
          {feed.partnership ? <p>{feed.partnership}</p> : null}
          {feed.lastWicket ? <p className="text-charcoal/60">{feed.lastWicket}</p> : null}
        </div>
      )}

      {feed.recentOvers.length > 0 && (
        <div>
          <h3 className="mb-3 font-display text-xs font-extrabold uppercase tracking-wider text-charcoal/70">
            Recent overs
          </h3>
          <div className="flex flex-wrap gap-4">
            {feed.recentOvers.map((over) => (
              <div key={over.overNumber} className="min-w-[140px]">
                <p className="mb-1.5 text-xs font-bold uppercase text-charcoal/50">
                  {overLabel(over.overNumber)}
                  {over.runsInOver > 0 ? (
                    <span className="ml-1 normal-case text-charcoal/40">{over.runsInOver} runs</span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-1">
                  {over.balls.map((ball) => (
                    <BallChip key={`${over.overNumber}-${ball.ball}`} label={ball.label} isWicket={ball.isWicket} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
