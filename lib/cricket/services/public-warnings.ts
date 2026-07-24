/**
 * Some entries in a snapshot's `warnings` array are sync-process narration meant for the admin
 * sync panel ("Discovered N future series from ESPNcricinfo.") rather than facts a site visitor
 * needs ("this data might be stale"). Both flow through the same `warnings: string[]` field
 * today, so public pages filter these specific patterns out before rendering rather than
 * showing internal sync chatter to visitors. The admin CricketSyncPanel renders the same
 * array unfiltered, which is where these are actually useful.
 */
const ADMIN_ONLY_PATTERNS = [
  /^Built \d+ tour\(s\) from upcoming Bangladesh fixtures/,
  /^Discovered \d+ future Bangladesh series from ESPNcricinfo\.$/,
  /^ESPNcricinfo: \d+ future tour\(s\) available\.$/,
];

export function publicFacingWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => !ADMIN_ONLY_PATTERNS.some((p) => p.test(w)));
}
