import assert from "node:assert/strict";
import test from "node:test";

import { formatUpcomingDomesticMarqueeLine } from "../../lib/cricket/services/marquee-domestic-format.ts";
import type { LiveMatchSummary } from "../../lib/cricket/types.ts";

/**
 * Domestic tracked-player fixtures (e.g. a Bangladeshi player's county match) now appear in the
 * marquee's upcoming section, but must never be formatted with formatUpcomingMatchMarqueeLine()'s
 * "Ban vs X" shape -- neither side of "Kent vs Somerset" is the Bangladesh team, so that would
 * wrongly read as Bangladesh themselves playing Kent.
 */
function domesticMatch(overrides: Partial<LiveMatchSummary> = {}): LiveMatchSummary {
  return {
    id: "espn-1",
    name: "Kent vs Somerset",
    status: "Match not started",
    teams: ["Kent", "Somerset"],
    isLive: false,
    trackedPlayerName: "Mustafizur Rahman",
    leagueLabel: "County Championship",
    dateTimeGMT: "2026-06-09T10:00:00.000Z",
    ...overrides,
  };
}

test("formatUpcomingDomesticMarqueeLine leads with the player name, not 'Ban vs'", () => {
  const line = formatUpcomingDomesticMarqueeLine(domesticMatch());
  assert.match(line, /^Mustafizur Rahman/);
  assert.doesNotMatch(line, /^Ban vs/);
});

test("formatUpcomingDomesticMarqueeLine includes both team names and the league label", () => {
  const line = formatUpcomingDomesticMarqueeLine(domesticMatch());
  assert.match(line, /Kent vs Somerset/);
  assert.match(line, /County Championship/);
});

test("formatUpcomingDomesticMarqueeLine tolerates a missing player name or league label", () => {
  const line = formatUpcomingDomesticMarqueeLine(
    domesticMatch({ trackedPlayerName: undefined, leagueLabel: undefined }),
  );
  assert.match(line, /Kent vs Somerset/);
  assert.doesNotMatch(line, /undefined/);
});
