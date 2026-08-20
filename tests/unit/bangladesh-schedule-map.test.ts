import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyMatchStatus,
  isRelevantSeriesWindow,
  mapCricApiMatchToUpsertRow,
  resolveMatchCategory,
  type RawCricApiMatch,
} from "../../lib/cricket/services/bangladesh-schedule-map.ts";

function isBangladeshTeam(name: string): boolean {
  return /bangladesh|\bban\b/i.test(name);
}

function baseMatch(overrides: Partial<RawCricApiMatch> = {}): RawCricApiMatch {
  return {
    id: "m1",
    name: "Bangladesh vs Australia, 3rd Test",
    status: "Match not started",
    teams: ["Bangladesh", "Australia"],
    isLive: false,
    ...overrides,
  };
}

test("classifyMatchStatus: live only when isLive and status text reads as in-progress", () => {
  assert.equal(
    classifyMatchStatus(baseMatch({ isLive: true, status: "Bangladesh 1st innings 144/3 (32 ov)" })),
    "live",
  );
  // isLive flag stuck true after the match actually finished -- status text wins.
  assert.equal(
    classifyMatchStatus(baseMatch({ isLive: true, status: "Bangladesh won by 4 wickets" })),
    "completed",
  );
});

test("classifyMatchStatus: completed from a result phrase even when isLive is false", () => {
  assert.equal(
    classifyMatchStatus(baseMatch({ status: "Australia won by 22 runs" })),
    "completed",
  );
});

test("classifyMatchStatus: falls back to upcoming for a not-started fixture", () => {
  assert.equal(classifyMatchStatus(baseMatch({ status: "Match starts in 2 days" })), "upcoming");
});

test("classifyMatchStatus: old unstarted-looking match with a score an hour+ ago counts as completed", () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  assert.equal(
    classifyMatchStatus(
      baseMatch({
        status: "Innings break",
        dateTimeGMT: twoHoursAgo,
        score: [{ r: 250, w: 8, o: 50 }],
      }),
    ),
    "completed",
  );
});

test("resolveMatchCategory: trusts explicit 'women'/'u19'/'emerging' text over the search category", () => {
  assert.equal(
    resolveMatchCategory("men", { name: "Bangladesh Women vs India Women, 1st ODI", teams: [] }),
    "women",
  );
  assert.equal(
    resolveMatchCategory("men", { name: "ACC U19 Asia Cup, Bangladesh vs Nepal", teams: [] }),
    "u19",
  );
});

test("resolveMatchCategory: doesn't downgrade a women's-search result to 'men' just because the text is generic", () => {
  assert.equal(
    resolveMatchCategory("women", { name: "3rd T20I, Bangladesh vs South Africa", teams: [] }),
    "women",
  );
});

test("isRelevantSeriesWindow: keeps a series ending recently or starting soon, drops ancient history", () => {
  const now = new Date("2026-08-20T00:00:00.000Z").getTime();

  assert.equal(
    isRelevantSeriesWindow({ startDate: "2026-08-01", endDate: "2026-08-15" }, now),
    true,
  );
  assert.equal(
    isRelevantSeriesWindow({ startDate: "2026-09-01", endDate: "2026-09-10" }, now),
    true,
  );
  assert.equal(
    isRelevantSeriesWindow({ startDate: "2019-01-01", endDate: "2019-01-15" }, now),
    false,
  );
});

test("mapCricApiMatchToUpsertRow: builds the full upsert row, opponent excludes Bangladesh's own name", () => {
  const row = mapCricApiMatchToUpsertRow(
    baseMatch({
      status: "Australia won by 22 runs",
      score: [
        { r: 300, w: 10, o: 90, inning: "Bangladesh 1st innings" },
        { r: 278, w: 10, o: 85, inning: "Australia 1st innings" },
      ],
    }),
    "men",
    { id: "1532475", name: "Australia tour of Bangladesh, 2026" },
    isBangladeshTeam,
  );

  assert.equal(row.match_id, "cricapi-m1");
  assert.equal(row.team_category, "men");
  assert.equal(row.status, "completed");
  assert.equal(row.opponent, "Australia");
  assert.equal(row.series_id, "1532475");
  assert.match(row.score_summary ?? "", /300\/10/);
});
