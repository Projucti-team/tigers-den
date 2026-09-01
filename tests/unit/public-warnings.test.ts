import assert from "node:assert/strict";
import test from "node:test";

import { publicFacingWarnings } from "../../lib/cricket/services/public-warnings.ts";

test("publicFacingWarnings strips CricAPI key-exhaustion / rate-limit chatter", () => {
  const filtered = publicFacingWarnings([
    "API key exhausted.",
    "Backup API key exhausted.",
    "Backup API key 2 exhausted.",
    "Blocked for 15 minutes",
  ]);
  assert.deepEqual(filtered, []);
});

test("publicFacingWarnings strips raw provider names and dev/ops instructions", () => {
  const filtered = publicFacingWarnings([
    "CricAPI unavailable — using ESPNcricinfo for tours.",
    "Tour data not loaded yet. Run `npm run sync:cricket` or wait for the nightly refresh (~3:00 AM BDT).",
    "ICC rankings unavailable. Run npm run scrape:icc-rankings to refresh data/icc-rankings.json.",
  ]);
  assert.deepEqual(filtered, []);
});

test("publicFacingWarnings keeps a genuinely visitor-relevant stale-data message", () => {
  const filtered = publicFacingWarnings([
    "Tours data is 30h old — nightly refresh may have failed.",
  ]);
  assert.deepEqual(filtered, ["Tours data is 30h old — nightly refresh may have failed."]);
});

test("publicFacingWarnings still strips the original admin-only sync narration patterns", () => {
  const filtered = publicFacingWarnings([
    "Built 3 tour(s) from upcoming Bangladesh fixtures.",
    "Discovered 5 future Bangladesh series from ESPNcricinfo.",
    "ESPNcricinfo: 2 future tour(s) available.",
  ]);
  assert.deepEqual(filtered, []);
});
