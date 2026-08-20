import assert from "node:assert/strict";
import test from "node:test";

import { firstBangladeshTeamMatch } from "../../lib/cricket/services/marquee-priority.ts";
import type { MatchCategory } from "../../lib/cricket/match-category.ts";

/**
 * Regression test: the top marquee showed "LIVE · Kent 23/0 (6) (Kent won the toss and elected
 * to bat)" -- an admin-tracked domestic county match with a Bangladeshi player in the XI, not a
 * Bangladesh team match. getLiveMatchHighlights() deliberately includes domestic matches (the
 * Match Centre's picker needs them), but getMatchHighlight() was blindly taking liveMatches[0]
 * regardless of category, so once the real Bangladesh match ended, a still-live domestic match
 * being the *only* live entry let it hijack the marquee's live/headline slot.
 *
 * Imports from marquee-priority.ts (not match-highlight.ts) deliberately -- match-highlight.ts
 * transitively pulls in Payload's env loader via bangladesh-last-match.ts, which crashes when
 * imported outside a Next.js runtime (this is why the logic under test lives in its own
 * dependency-free module, matching filter-published-tours.ts's existing pattern).
 */
type FakeMatch = { matchId: string; title: string; category?: MatchCategory };

function match(overrides: Partial<FakeMatch> & { matchId: string }): FakeMatch {
  return { title: "Match", ...overrides };
}

test("firstBangladeshTeamMatch skips a domestic-only match even when it's first in the list", () => {
  const kent = match({ matchId: "espn-kent", title: "Kent vs Somerset", category: "domestic" });
  const result = firstBangladeshTeamMatch([kent]);
  assert.equal(result, null, "a domestic-only match must never become the marquee headline");
});

test("firstBangladeshTeamMatch picks the Bangladesh team match over a domestic one regardless of order", () => {
  const kent = match({ matchId: "espn-kent", title: "Kent vs Somerset", category: "domestic" });
  const banTest = match({ matchId: "espn-ban-aus", title: "Bangladesh vs Australia", category: "men" });

  assert.equal(firstBangladeshTeamMatch([kent, banTest])?.matchId, "espn-ban-aus");
  assert.equal(firstBangladeshTeamMatch([banTest, kent])?.matchId, "espn-ban-aus");
});

test("firstBangladeshTeamMatch treats an unset category as a real match (default 'men')", () => {
  const noCategory = match({ matchId: "espn-1" });
  assert.equal(firstBangladeshTeamMatch([noCategory])?.matchId, "espn-1");
});

test("firstBangladeshTeamMatch returns null for an empty list", () => {
  assert.equal(firstBangladeshTeamMatch([]), null);
});
