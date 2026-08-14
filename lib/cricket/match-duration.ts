/**
 * Estimates how long a match actually runs, given only its start date. Several places in this
 * codebase (tour status tracking, CricAPI's fallback tour-derivation path) only have a match's
 * *start* date to work with and were treating that as the match's entire span. That's fine for
 * ODI/T20 (single day), but a Test match is scheduled for up to 5 days — treating a Test's
 * start date as its end date marks a still-in-progress match "finished" the very next calendar
 * day, which cascades into the whole tour disappearing from nav/homepage listings and its
 * squad-refresh tracking being switched off mid-match.
 */
function matchDurationDays(matchType: string | null | undefined): number {
  return matchType?.toLowerCase() === "test" ? 5 : 1;
}

/** Inclusive estimated last day of play for a match that started on `start`. */
export function estimatedMatchEndDate(start: Date, matchType: string | null | undefined): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + matchDurationDays(matchType) - 1);
  return end;
}
