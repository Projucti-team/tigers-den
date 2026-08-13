import assert from "node:assert/strict";
import test from "node:test";

import { fetchWtcStandingsFromEspn } from "../../lib/cricket/providers/wtc-espn.ts";

/**
 * Regression test for two bugs reported live on the rankings page:
 *  1. Bangladesh was showing at rank 7 when it should have been rank 4 -- the table was sorted
 *     by whatever "rank" stat ESPN's core API returned per row (which tracked raw points, not
 *     points percentage), instead of by PCT like the official WTC table.
 *  2. An "Unknown" team appeared at the top of the table -- when ESPN's per-team $ref lookup
 *     failed, resolveTeam() fell back to the literal string "Unknown" instead of dropping the
 *     row, and that row's real ESPN "rank" stat happened to sort it to the top.
 */
function statRow(name: string, value: number) {
  return { name, value };
}

function standingRow(opts: {
  ref: string;
  rank: number;
  played: number;
  points: number;
}) {
  return {
    team: { $ref: opts.ref },
    records: [
      {
        stats: [
          statRow("rank", opts.rank),
          statRow("matchesPlayed", opts.played),
          statRow("matchPoints", opts.points),
          statRow("matchesWon", 0),
          statRow("matchesLost", 0),
          statRow("matchesDraw", 0),
          statRow("matchesTied", 0),
          statRow("noresult", 0),
        ],
      },
    ],
  };
}

test("fetchWtcStandingsFromEspn sorts by PCT (not raw ESPN rank/points) and drops teams that fail to resolve", async () => {
  const originalFetch = globalThis.fetch;

  // Australia: 84 pts / 8 matches = 87.5% -- correctly rank 1 either way.
  // India: 52 pts / 9 matches = 48.15%.
  // Bangladesh: 28 pts / 4 matches = 58.33% -- higher PCT than India despite fewer raw points,
  // so PCT-sorted Bangladesh must rank above India even though ESPN's own "rank" stat (and raw
  // points order) would put India ahead.
  // "broken-ref" team: $ref resolves to a 404, simulating a transient ESPN lookup failure.
  const standings = [
    standingRow({ ref: "https://espn/teams/aus", rank: 1, played: 8, points: 84 }),
    standingRow({ ref: "https://espn/teams/ind", rank: 2, played: 9, points: 52 }),
    standingRow({ ref: "https://espn/teams/ban", rank: 3, played: 4, points: 28 }),
    standingRow({ ref: "https://espn/teams/broken", rank: 0, played: 2, points: 24 }),
  ];

  const teamsByRef: Record<string, { displayName: string; abbreviation: string } | null> = {
    "https://espn/teams/aus": { displayName: "Australia", abbreviation: "AUS" },
    "https://espn/teams/ind": { displayName: "India", abbreviation: "IND" },
    "https://espn/teams/ban": { displayName: "Bangladesh", abbreviation: "BAN" },
    "https://espn/teams/broken": null,
  };

  globalThis.fetch = (async (url: string) => {
    if (url.includes("/leagues/")) {
      return {
        ok: true,
        json: async () => ({ standings }),
      } as Response;
    }
    const team = teamsByRef[url];
    if (!team) {
      return { ok: false, json: async () => ({}) } as Response;
    }
    return { ok: true, json: async () => team } as Response;
  }) as typeof fetch;

  try {
    const snapshot = await fetchWtcStandingsFromEspn();

    // The broken-ref row must not appear at all, let alone as "Unknown".
    assert.equal(
      snapshot.standings.some((t) => t.team === "Unknown"),
      false,
      "an unresolved team should be dropped, not shown as Unknown",
    );
    assert.equal(snapshot.standings.length, 3);

    // PCT order: Australia 87.5, Bangladesh 58.33, India 48.15.
    assert.deepEqual(
      snapshot.standings.map((t) => t.team),
      ["Australia", "Bangladesh", "India"],
    );

    const bangladesh = snapshot.standings.find((t) => t.team === "Bangladesh");
    assert.equal(bangladesh?.rank, 2, "rank must be derived from PCT order, not ESPN's raw rank stat");

    const india = snapshot.standings.find((t) => t.team === "India");
    assert.equal(india?.rank, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
