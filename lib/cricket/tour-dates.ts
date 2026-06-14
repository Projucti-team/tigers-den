/** CricAPI sometimes returns "Aug 26" without a year — infer from ISO startDate. */
function parseSeriesEndDate(endRaw: string | undefined, startIso: string | undefined): Date | null {
  if (!endRaw) return null;
  const trimmed = endRaw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const year = startIso ? new Date(startIso).getFullYear() : new Date().getFullYear();
  const d = new Date(`${trimmed} ${year}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isFutureSeries(startDate?: string, endDate?: string): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const start = startDate ? new Date(startDate) : null;
  const end = parseSeriesEndDate(endDate, startDate);

  if (start && !Number.isNaN(start.getTime())) {
    if (start >= now) return true;
    // Include in-progress series (CricAPI often omits endDate until the tour finishes).
    const daysSinceStart = (now.getTime() - start.getTime()) / 86_400_000;
    if (daysSinceStart >= 0 && daysSinceStart <= 180 && (!end || end >= now)) {
      return true;
    }
  }

  if (end && end >= now) return true;
  return false;
}
