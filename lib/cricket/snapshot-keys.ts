export const CRICKET_SNAPSHOT_KEYS = {
  rankingsShowcase: "rankings-showcase",
  toursIndex: "tours-index",
  syncLock: "cricket-sync-lock",
  tourDetail: (slug: string) => `tour-detail:${slug}`,
} as const;

export const AUTO_SYNC_MAX_AGE_HOURS = 24;

export function isTourDetailSnapshotKey(key: string): boolean {
  return key.startsWith("tour-detail:");
}

export function tourDetailSlugFromKey(key: string): string | null {
  if (!isTourDetailSnapshotKey(key)) return null;
  return key.slice("tour-detail:".length) || null;
}
