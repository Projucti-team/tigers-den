import assert from "node:assert/strict";
import test from "node:test";

import {
  isMultiInningsMatch,
  teamForPeriod,
} from "../../lib/cricket/providers/espn-match-centre.ts";

test("teamForPeriod alternates batting teams across a Test match", () => {
  const teams = ["Kent", "Middlesex"];

  assert.equal(teamForPeriod(teams, "Middlesex", 4, 4), "Middlesex");
  assert.equal(teamForPeriod(teams, "Middlesex", 4, 3), "Kent");
  assert.equal(teamForPeriod(teams, "Middlesex", 4, 2), "Middlesex");
  assert.equal(teamForPeriod(teams, "Middlesex", 4, 1), "Kent");
});

test("isMultiInningsMatch detects Tests and four-innings matches", () => {
  assert.equal(isMultiInningsMatch(4, [], "Lunch · Middlesex require another 179 runs"), true);
  assert.equal(isMultiInningsMatch(2, [], "Bangladesh won by 5 wickets"), false);
  assert.equal(
    isMultiInningsMatch(
      2,
      [{ typeID: "11", inningsNumber: "1" }, { typeID: "11", inningsNumber: "2" }],
      "Day 2 · Stumps",
    ),
    true,
  );
});

test("isMultiInningsMatch regression: Test match with a plain note and no historical batting cards", () => {
  // Reproduces the "scorecard only shows current innings" bug: ESPN's free-text note for a
  // live Test often doesn't contain the word "test" ("Bangladesh need 96 runs" etc.), and if
  // the matchcards response only carries the currently-batting innings' card (no card yet for
  // completed earlier innings), the old note/battingCards-only heuristic misses it entirely and
  // routes to the 2-innings-max limited-overs builder, silently dropping earlier innings.
  // Cricinfo's own match.format field is the fix — authoritative regardless of note wording.
  assert.equal(
    isMultiInningsMatch(2, [{ typeID: "11", inningsNumber: "2" }], "Bangladesh need 96 runs", "Test"),
    true,
  );
  assert.equal(
    isMultiInningsMatch(3, [{ typeID: "11", inningsNumber: "3" }], "Stumps", "test"),
    true,
  );
  // First innings still under way (period 1) — correctly not multi-innings yet even with format
  // set, since there's only one innings to show so far.
  assert.equal(isMultiInningsMatch(1, [], "Bangladesh 45/1", "Test"), false);
  // Non-Test format must not be forced true by the format branch.
  assert.equal(isMultiInningsMatch(2, [], "Bangladesh won by 5 wickets", "ODI"), false);
});
