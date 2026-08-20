import type { MatchCategory } from "@/lib/cricket/match-category";

/**
 * Pure filtering step, deliberately dependency-free (only match-category.ts, no Payload/DB
 * imports) so it's directly unit-testable without pulling in match-highlight.ts's full import
 * chain — that chain drags in Payload's env loader via bangladesh-last-match.ts / snapshot-db.ts,
 * which crashes outside a Next.js runtime (see filter-published-tours.ts for the same pattern).
 *
 * First entry that's an actual Bangladesh representative-team match (men/women/u19/emerging),
 * skipping admin-tracked domestic-only matches (a county match with a Bangladeshi player in the
 * XI, say). Used to stop a domestic match from hijacking the top marquee's live headline when
 * it's the only thing still live.
 */
export function firstBangladeshTeamMatch<T extends { category?: MatchCategory }>(
  matches: T[],
): T | null {
  return matches.find((m) => (m.category ?? "men") !== "domestic") ?? null;
}
