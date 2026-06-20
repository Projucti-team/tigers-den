"use client";

import { matchCategoryLabel } from "@/lib/cricket/match-category";
import type { MatchHighlight } from "@/lib/cricket/services/match-highlight";

type MatchCentreMatchPickerProps = {
  matches: MatchHighlight[];
  selectedMatchId: string | null;
  onSelect: (matchId: string) => void;
};

export function MatchCentreMatchPicker({
  matches,
  selectedMatchId,
  onSelect,
}: MatchCentreMatchPickerProps) {
  if (matches.length <= 1) return null;

  return (
    <div
      className="flex flex-wrap gap-2 border-b border-emerald/15 bg-white/60 px-4 py-3 md:px-5"
      role="tablist"
      aria-label="Live matches"
    >
      {matches.map((match, index) => {
        const selected = match.matchId === selectedMatchId;
        const category = match.category ? matchCategoryLabel(match.category) : "Match";
        const label =
          match.bannerTitle ??
          `${index + 1}. ${category}${match.leagueLabel ? ` · ${match.leagueLabel}` : ""}`;

        return (
          <button
            key={match.matchId}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(match.matchId)}
            className={`rounded-full border-2 px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide transition ${
              selected
                ? "border-emerald bg-emerald text-white shadow-sm"
                : "border-charcoal/15 bg-white text-charcoal/75 hover:border-emerald/40 hover:text-emerald"
            }`}
            title={match.title}
          >
            <span className="block max-w-[220px] truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
