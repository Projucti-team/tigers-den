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
