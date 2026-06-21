import type { TourDetailSnapshot } from "@/lib/cricket/snapshot-types";

export type TourDetailAuditIssue = {
  code: string;
  message: string;
};

const UPCOMING_STATUS =
  /not started|upcoming|scheduled|fixture|match starts|scheduled to begin|toss/i;
const RESULT_STATUS = /won|beat|defeat|tied|draw|no result|abandon|completed|finished|margin/i;

function endOfUtcDay(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.000Z`);
}

/** Catch regressions like duplicate team labels, missing venues, or stale "Match starts" on past games. */
export function auditTourDetailSnapshot(
  detail: TourDetailSnapshot,
  options?: { referenceDate?: Date },
): TourDetailAuditIssue[] {
  const issues: TourDetailAuditIssue[] = [];
  const referenceDate = options?.referenceDate ?? new Date();

  for (const match of detail.matches) {
    const vsInName = match.name.match(/,\s*([^,]+?)\s+vs\s+([^,]+?)\s*,/i);
    if (vsInName) {
      const home = vsInName[1].trim().toLowerCase();
      const away = vsInName[2].trim().toLowerCase();
      if (home === away) {
        issues.push({
          code: "duplicate-team-label",
          message: `Match name repeats the same team: "${match.name}"`,
        });
      }
    }

    if (!match.date) continue;
    if (match.seriesId && detail.tour.id && match.seriesId !== detail.tour.id) {
      issues.push({
        code: "series-id-mismatch",
        message: `Match ${match.id} is tagged to series ${match.seriesId}, expected tour ${detail.tour.id}`,
      });
    }

    const matchEnd = endOfUtcDay(match.date);
    if (matchEnd >= referenceDate) continue;

    const status = match.status.trim();
    if (!status) continue;

    if (UPCOMING_STATUS.test(status) && !RESULT_STATUS.test(status)) {
      issues.push({
        code: "stale-upcoming-status",
        message: `Past match on ${match.date} still shows upcoming status: "${status}"`,
      });
    }
  }

  const matchesWithVenue = detail.matches.filter((m) => m.venue?.trim());
  if (matchesWithVenue.length > 0 && detail.venues.length === 0) {
    issues.push({
      code: "missing-venue-guides",
      message: `${matchesWithVenue.length} fixture(s) have a venue but the tour snapshot has no venue guides`,
    });
  }

  for (const guide of detail.venues) {
    if (!guide.city?.trim() || !guide.about?.trim() || !guide.cityAbout?.trim()) {
      issues.push({
        code: "incomplete-venue-guide",
        message: `Venue guide "${guide.venueName}" is missing city or description copy`,
      });
    }
  }

  return issues;
}

export function formatTourDetailAuditIssues(issues: TourDetailAuditIssue[]): string[] {
  return issues.map((issue) => `[${issue.code}] ${issue.message}`);
}
