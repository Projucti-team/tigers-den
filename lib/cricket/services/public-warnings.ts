/**
 * Some entries in a snapshot's `warnings` array are sync-process narration meant for the admin
 * sync panel ("Discovered N future series from ESPNcricinfo.", "API key exhausted.", "Blocked
 * for 15 minutes") rather than facts a site visitor needs ("this data might be stale"). Both
 * flow through the same `warnings: string[]` field today, so public pages filter these specific
 * patterns out before rendering rather than showing internal sync/ops chatter to visitors. The
 * admin CricketSyncPanel renders the same array unfiltered, which is where these are actually
 * useful.
 *
 * This is a blocklist, not an allowlist, so it can't catch every possible internal message --
 * but a visitor seeing raw provider/quota/rate-limit chatter (API keys, CricAPI, "Run npm run
 * ...") is exactly the failure mode this exists to prevent, so those categories are covered
 * broadly (by shape, not just exact strings) rather than one hardcoded message at a time.
 */
const ADMIN_ONLY_PATTERNS = [
  /^Built \d+ tour\(s\) from upcoming Bangladesh fixtures/,
  /^Discovered \d+ future Bangladesh series from ESPNcricinfo\.$/,
  /^ESPNcricinfo: \d+ future tour\(s\) available\.$/,
  // API key / quota / rate-limit chatter (CricAPI key exhaustion, temporary blocks).
  /API key( \d+)? exhausted\.?$/i,
  /^Blocked for \d+ minutes?\.?$/i,
  /rate.?limit/i,
  // Raw provider names + failure chatter -- a visitor doesn't need to know which upstream
  // provider or admin command is involved, only the admin sync panel does.
  /\bCricAPI\b/i,
  /\bESPNcricinfo\b/i,
  /\bCRICKET_DATA_API_KEY\b/i,
  // Dev/ops instructions that only make sense to whoever runs the sync job.
  /run `?npm run/i,
  /wait for the nightly refresh/i,
  /check \/api\//i,
];

export function publicFacingWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => !ADMIN_ONLY_PATTERNS.some((p) => p.test(w)));
}
