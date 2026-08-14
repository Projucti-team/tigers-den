import assert from "node:assert/strict";
import test from "node:test";

import { estimatedMatchEndDate } from "../../lib/cricket/match-duration.ts";
import { isFutureSeries } from "../../lib/cricket/tour-dates.ts";

/**
 * Regression test: the Bangladesh vs Australia Darwin Test disappeared from the TOURS nav
 * dropdown (and homepage cards) on day 2 of the match, while it was still live. Root cause was
 * that every tour-building path computed a single-Test tour's `endDate` as the match's raw
 * start date instead of its actual ~5-day span (see espn-fixtures.ts tourFromFixtures /
 * fetchCuratedEspnTours and cricapi.ts deriveToursFromUpcomingMatches, all fixed to use
 * estimatedMatchEndDate()). isFutureSeries() then correctly required `endDate >= now`, but
 * with a stale endDate equal to day 1, that was false as soon as day 2 arrived, and the tour
 * vanished from every listing built from that tours snapshot.
 */
test("estimatedMatchEndDate gives a Test 5 days, and a single-day format 1 day", () => {
  const start = new Date("2026-08-13T00:00:00.000Z");

  const testEnd = estimatedMatchEndDate(start, "test");
  assert.equal(testEnd.toISOString().slice(0, 10), "2026-08-17");

  const odiEnd = estimatedMatchEndDate(start, "odi");
  assert.equal(odiEnd.toISOString().slice(0, 10), "2026-08-13");

  const t20End = estimatedMatchEndDate(start, "t20");
  assert.equal(t20End.toISOString().slice(0, 10), "2026-08-13");
});

test("a single-Test tour starting yesterday stays in the future-tours list today (the actual reported bug)", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  // This is exactly what the OLD buggy code produced: endDate === startDate for a lone Test.
  const buggyEndDate = yesterday.toISOString();
  assert.equal(
    isFutureSeries(yesterday.toISOString(), buggyEndDate),
    false,
    "sanity check: this is the bug we're regression-testing against",
  );

  // This is what the FIXED code now produces: endDate accounts for the Test's ~5-day span.
  const fixedEndDate = estimatedMatchEndDate(yesterday, "test").toISOString();
  assert.equal(
    isFutureSeries(yesterday.toISOString(), fixedEndDate),
    true,
    "an in-progress Test (started yesterday) must still count as a future/current series today",
  );
});
