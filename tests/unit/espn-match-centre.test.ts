import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalTeamName,
  dedupeAndRelabelInnings,
  isMultiInningsMatch,
  parseTeamScoreDisplay,
  teamForPeriod,
} from "../../lib/cricket/providers/espn-match-centre.ts";
import type { Scorecard } from "../../lib/cricket/types.ts";

test("parseTeamScoreDisplay regression: all-out innings dropped a team from teamSummaries entirely", () => {
  // Root cause of "both innings blocks show Bangladesh": the old regex required a literal
  // "runs/wickets" format and returned no match at all for a completed all-out innings, which
  // ESPN can display without a wicket count ("198 (53 ov)"). That silently dropped the team
  // from teamSummaries, leaving only one team in the list — so every by-team lookup elsewhere
  // (teamForPeriod, the totals-fix's teamSummaries.find) collapsed onto that single survivor
  // regardless of which period was actually being resolved.
  assert.deepEqual(parseTeamScoreDisplay("198 (53 ov)"), { runs: 198, wickets: 10, overs: 53 });
  assert.deepEqual(parseTeamScoreDisplay("198/10 (53 ov)"), { runs: 198, wickets: 10, overs: 53 });
  assert.deepEqual(parseTeamScoreDisplay("96/1 (24 ov)"), { runs: 96, wickets: 1, overs: 24 });
  assert.equal(parseTeamScoreDisplay(""), null);
});

test("teamForPeriod alternates batting teams across a Test match", () => {
  const teams = ["Kent", "Middlesex"];

  assert.equal(teamForPeriod(teams, "Middlesex", 4, 4), "Middlesex");
  assert.equal(teamForPeriod(teams, "Middlesex", 4, 3), "Kent");
  assert.equal(teamForPeriod(teams, "Middlesex", 4, 2), "Middlesex");
  assert.equal(teamForPeriod(teams, "Middlesex", 4, 1), "Kent");
});

test("teamForPeriod regression: abbreviated battingTeam doesn't substring-match the full team name", () => {
  // Reproduces the "AUS's completed innings mislabeled BANGLADESH" bug: when battingTeam is a
  // short form ("BAN") that isn't a substring of the full name in `teams` ("Bangladesh") in
  // either direction under the old check, currentIdx fell back to 0 and the alternation could
  // point at the wrong team entirely, independent of which team is actually listed first.
  const teams = ["Australia", "Bangladesh"];
  assert.equal(teamForPeriod(teams, "BAN", 2, 1), "Australia");
  assert.equal(teamForPeriod(teams, "BAN", 2, 2), "Bangladesh");

  const teamsReversed = ["Bangladesh", "Australia"];
  assert.equal(teamForPeriod(teamsReversed, "BAN", 2, 1), "Australia");
  assert.equal(teamForPeriod(teamsReversed, "BAN", 2, 2), "Bangladesh");
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

test("isMultiInningsMatch regression: real BAN v AUS Darwin Test — note shadows the description that says 'Test'", () => {
  // The actual production bug: espn-match-centre.ts used to build competitionNote as
  // `competition.note ?? competition.shortDescription`, so whenever ESPN set `note` to a live
  // status line, `shortDescription` (which carries the "1st Test, at Darwin"-style headline)
  // was discarded entirely by the ?? fallback before isMultiInningsMatch ever saw it. The fix
  // is to pass a blob combining description + shortDescription + note instead of picking one.
  const noteOnly = "Stumps · Bangladesh trail by 102 runs with 9 wickets remaining in the 1st innings";
  const blobWithHeadline = `1st Test, at Darwin ${noteOnly}`;

  // Old bug reproduction: note alone (what used to reach the function) has no "test" in it and
  // there's no historical battingCard for AUS's completed innings — misclassified as false.
  assert.equal(isMultiInningsMatch(2, [{ typeID: "11", inningsNumber: "2" }], noteOnly), false);

  // Fixed: combined blob carries "Test" from the headline, regardless of where note points.
  assert.equal(
    isMultiInningsMatch(2, [{ typeID: "11", inningsNumber: "2" }], blobWithHeadline),
    true,
  );
});

test("parseTeamScoreDisplay regression: a combined 'X & Y' display must use the latest segment, not the first", () => {
  // A team that has batted twice can be shown as "217 & 199/4" (first innings total & current
  // second-innings score). Reading only the leading number reported the team's completed FIRST
  // innings as if it were their live total -- the exact stale value that leaked into a phantom
  // duplicate innings entry for Worcestershire in the Kent v Worcestershire scorecard bug.
  assert.deepEqual(parseTeamScoreDisplay("217 & 199/4 (52 ov)"), { runs: 199, wickets: 4, overs: 52 });
  assert.deepEqual(parseTeamScoreDisplay("217/10"), { runs: 217, wickets: 10, overs: 0 });
});

test("canonicalTeamName maps an established short form back to the full team name", () => {
  // "Worcs" shares no contiguous substring with "Worcestershire" (there's an extra "e" in the
  // full name right where the abbreviation drops it), so a plain substring/includes check never
  // unifies them -- this was the direct cause of the same real team appearing as two different
  // identities ("Worcestershire" and "Worcs") in the same scorecard.
  const teams = ["Worcestershire", "Kent"];
  assert.equal(canonicalTeamName("Worcs", teams), "Worcestershire");
  assert.equal(canonicalTeamName("Worcestershire", teams), "Worcestershire");
  assert.equal(canonicalTeamName("Kent", teams), "Kent");
  // No reasonable match at all (score below threshold) -- fall back to the raw string rather
  // than guessing.
  assert.equal(canonicalTeamName("Somerset", teams), "Somerset");
});

test("dedupeAndRelabelInnings regression: Kent v Worcestershire scorecard showed a duplicated, mislabeled innings", () => {
  // Reproduces the reported bug exactly: "Worcestershire 1st Innings 217/10" (no batting card),
  // "Kent 1st Innings 238/10" (no batting card), a spurious duplicate "Worcestershire 2nd
  // Innings 217/10" (identical total, no batting card -- produced by a phantom period falling
  // back to a stale combined-score total), and "Worcs 1st Innings 199/4" (the real, live second
  // Worcestershire innings, wrongly labeled "1st" because its teamName string never matched the
  // earlier "Worcestershire" entries).
  const teams = ["Worcestershire", "Kent"];
  const liveBatting: Scorecard["innings"][number]["batting"] = [
    { name: "B D'Oliveira", runs: 67, dismissed: "not out" },
  ];

  const raw: Scorecard["innings"] = [
    { inning: "Worcestershire 1st Innings", runs: 217, wickets: 10, overs: 52, batting: [], bowling: [] },
    { inning: "Kent 1st Innings", runs: 238, wickets: 10, overs: 60, batting: [], bowling: [] },
    { inning: "Worcestershire 2nd Innings", runs: 217, wickets: 10, overs: 52, batting: [], bowling: [] },
    { inning: "Worcs 1st Innings", runs: 199, wickets: 4, overs: 52, batting: liveBatting, bowling: [] },
  ];

  const result = dedupeAndRelabelInnings(raw, teams);

  assert.deepEqual(
    result.map((r) => r.inning),
    ["Worcestershire 1st Innings", "Worcestershire 2nd Innings", "Kent 1st Innings"],
  );

  const worcSecond = result.find((r) => r.inning === "Worcestershire 2nd Innings");
  assert.equal(worcSecond?.runs, 199, "the surviving 2nd innings must be the real live total, not the stale duplicate");
  assert.equal(worcSecond?.batting.length, 1, "the surviving 2nd innings must keep the real batting card");

  const worcFirst = result.find((r) => r.inning === "Worcestershire 1st Innings");
  assert.equal(worcFirst?.runs, 217);

  assert.equal(result.length, 3, "the exact-duplicate 217/10 entry must be collapsed away");
});
