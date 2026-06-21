import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { formatMatchStatus } from "../../lib/cricket/datetime-bd.ts";
import { sanitizeTourSnapshotForRead } from "../../lib/cricket/tour-detail-sanitize.ts";
import {
  applyFormatCountsFromMatches,
  deduplicateTours,
  espnFixturesLookComplete,
  expectedTourFixtureCount,
  filterMatchesForTour,
  matchVenueMatchesTourHost,
  matchWithinTourWindow,
  parseTourTeamsFromName,
  squadBelongsToTour,
  tourNamesShareVenue,
  tourSeasonKey,
  tourVenueKey,
} from "../../lib/cricket/tour-identity.ts";
import { mergeTourFixtures } from "../../lib/cricket/services/merge-tour-fixtures.ts";
import type { Tour } from "../../lib/cricket/types.ts";
import {
  auditTourDetailSnapshot,
  formatTourDetailAuditIssues,
} from "../../lib/cricket/tour-detail-audit.ts";
import type { TourDetailSnapshot } from "../../lib/cricket/snapshot-types.ts";
import type { LiveMatchSummary } from "../../lib/cricket/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("parseTourTeamsFromName lists Bangladesh first for home tours", () => {
  assert.deepEqual(parseTourTeamsFromName("Australia tour of Bangladesh, 2026"), [
    "Bangladesh",
    "Australia",
  ]);
  assert.deepEqual(parseTourTeamsFromName("Bangladesh tour of Zimbabwe, 2026"), [
    "Bangladesh",
    "Zimbabwe",
  ]);
});

test("tourNamesShareVenue distinguishes home vs away bilateral tours", () => {
  const australiaInBd = "Australia tour of Bangladesh, 2026";
  const bangladeshInAu = "Bangladesh Tour of Australia";

  assert.notEqual(tourVenueKey(australiaInBd), tourVenueKey(bangladeshInAu));
  assert.equal(tourNamesShareVenue(australiaInBd, "Australia in Bangladesh ODI Series"), true);
  assert.equal(tourNamesShareVenue(bangladeshInAu, australiaInBd), false);
});

test("filterMatchesForTour strips Australia-in-Bangladesh fixtures from other tours", () => {
  const ausInBdMatches = [
    {
      id: "espn-1532480",
      name: "1st ODI,  at Dhaka",
      status: "Bangladesh won by 86 runs",
      venue: "Shere Bangla National Stadium, Mirpur, Dhaka",
      date: "2026-06-09",
      seriesId: "1527259",
      teams: ["Bangladesh", "Australia"],
      isLive: false,
    },
  ] satisfies LiveMatchSummary[];

  const australiaTour = {
    id: "1532475",
    name: "Australia tour of Bangladesh, 2026",
  } satisfies Tour;
  const bangladeshInAustraliaTour = {
    id: "1527259",
    name: "Bangladesh Tour of Australia",
  } satisfies Tour;
  const womenInAustraliaTour = {
    id: "4d3b12d1-2699-4b19-873f-144719dc9bc7",
    name: "Bangladesh Women tour of Australia",
  } satisfies Tour;

  assert.equal(filterMatchesForTour(australiaTour, ausInBdMatches).length, 1);
  assert.equal(filterMatchesForTour(bangladeshInAustraliaTour, ausInBdMatches).length, 0);
  assert.equal(filterMatchesForTour(womenInAustraliaTour, ausInBdMatches).length, 0);
});

test("sanitizeTourSnapshotForRead drops venues and squads when fixtures belong to another tour", () => {
  const tour = {
    id: "1527259",
    name: "Bangladesh Tour of Australia",
    test: 2,
  } satisfies Tour;
  const cached = {
    fetchedAt: "2026-06-01T00:00:00.000Z",
    slug: "bangladesh-tour-of-australia-1527259",
    warnings: [],
    tour,
    card: { title: "Bangladesh Tour of Australia", description: "2 Tests", href: "/tours/x" },
    matches: [
      {
        id: "espn-1532480",
        name: "1st ODI,  at Dhaka",
        status: "Bangladesh won by 86 runs",
        venue: "Shere Bangla National Stadium, Mirpur, Dhaka",
        date: "2026-06-09",
        seriesId: "1527259",
        teams: ["Bangladesh", "Australia"],
        isLive: false,
      },
    ],
    squads: [{ team: "Australia — ODI squad", players: [{ name: "Pat Cummins" }] }],
    venues: [
      {
        venueName: "Shere Bangla National Stadium, Mirpur, Dhaka",
        city: "Dhaka",
        about: "x",
        cityAbout: "y",
        weather: "z",
      },
    ],
  } satisfies TourDetailSnapshot;

  const sanitized = sanitizeTourSnapshotForRead(tour, cached);
  assert.equal(sanitized.matches.length, 0);
  assert.equal(sanitized.squads.length, 1);
  assert.equal(sanitized.venues.length, 0);
});

test("squadBelongsToTour keeps both teams on Australia tour of Bangladesh", () => {
  const tour = {
    id: "1532475",
    name: "Australia tour of Bangladesh, 2026",
    odi: 3,
    t20: 3,
  } satisfies Tour;

  assert.equal(
    squadBelongsToTour(
      {
        team: "Bangladesh — ODI squad",
        source:
          "https://www.espncricinfo.com/story/bangladesh-recall-mosaddek-after-four-years-for-odis-against-australia-1539528",
      },
      tour,
    ),
    true,
  );
  assert.equal(
    squadBelongsToTour(
      {
        team: "Australia — ODI squad",
        source:
          "https://www.espncricinfo.com/story/travis-head-out-of-bangladesh-tour-mitchell-marsh-to-miss-odis-todd-murphy-called-up-1539607",
      },
      tour,
    ),
    true,
  );
});

test("squadBelongsToTour accepts ESPN squads without tour format counts", () => {
  const tour = {
    id: "1532475",
    name: "Australia tour of Bangladesh, 2026",
  } satisfies Tour;

  assert.equal(
    squadBelongsToTour({ team: "Bangladesh — T20I squad", players: [{ name: "Litton Das" }] }, tour),
    true,
  );
});

test("squadBelongsToTour rejects ODI squads on a Test-only away tour", () => {
  const tour = {
    id: "1527259",
    name: "Bangladesh Tour of Australia",
    test: 2,
  } satisfies Tour;

  assert.equal(
    squadBelongsToTour({ team: "Australia — ODI squad", players: [{ name: "Pat Cummins" }] }, tour),
    false,
  );
  assert.equal(
    squadBelongsToTour({ team: "Australia — Test squad", players: [{ name: "Pat Cummins" }] }, tour),
    true,
  );
});

test("matchVenueMatchesTourHost rejects Bangladesh venues on Australia tour", () => {
  const match = {
    id: "espn-1532480",
    name: "1st ODI,  at Dhaka",
    status: "Bangladesh won by 86 runs",
    venue: "Shere Bangla National Stadium, Mirpur, Dhaka",
    date: "2026-06-09",
    isLive: false,
  } satisfies LiveMatchSummary;

  assert.equal(matchVenueMatchesTourHost(match, "Australia tour of Bangladesh, 2026"), true);
  assert.equal(matchVenueMatchesTourHost(match, "Bangladesh Tour of Australia"), false);
});

test("formatMatchStatus keeps completed result text", () => {
  const match: LiveMatchSummary = {
    id: "1",
    name: "1st ODI",
    status: "Bangladesh won by 86 runs (DLS method)",
    date: "2026-06-09",
    dateTimeGMT: "2026-06-09T05:00:00.000Z",
    isLive: false,
  };

  assert.equal(formatMatchStatus(match), "Bangladesh won by 86 runs (DLS method)");
});

test("formatMatchStatus rewrites upcoming copy to BDT", () => {
  const match: LiveMatchSummary = {
    id: "2",
    name: "3rd T20I",
    status: "Match not started",
    date: "2026-06-21",
    dateTimeGMT: "2026-06-21T08:00:00.000Z",
    isLive: false,
  };

  assert.match(formatMatchStatus(match), /Match starts .+ BDT/);
});

test("auditTourDetailSnapshot flags duplicate team labels", () => {
  const detail = {
    fetchedAt: "2026-06-01T00:00:00.000Z",
    slug: "bad-tour",
    warnings: [],
    tour: { id: "1", name: "Bad tour" },
    card: { title: "Bad", description: "", href: "/tours/bad" },
    matches: [
      {
        id: "bad-1",
        name: "1st ODI, Australia vs Australia, Australia tour of Bangladesh, 2026",
        status: "Match not started",
        date: "2026-06-09",
        isLive: false,
      },
    ],
    squads: [],
    venues: [],
  } satisfies TourDetailSnapshot;

  const issues = auditTourDetailSnapshot(detail, {
    referenceDate: new Date("2026-06-10T00:00:00.000Z"),
  });

  assert.ok(issues.some((issue) => issue.code === "duplicate-team-label"));
});

test("auditTourDetailSnapshot flags missing venue guides", () => {
  const detail = {
    fetchedAt: "2026-06-01T00:00:00.000Z",
    slug: "no-venues",
    warnings: [],
    tour: { id: "1", name: "Tour" },
    card: { title: "Tour", description: "", href: "/tours/no-venues" },
    matches: [
      {
        id: "m1",
        name: "1st ODI",
        status: "Bangladesh won by 5 wickets",
        date: "2026-06-09",
        venue: "Shere Bangla National Stadium, Mirpur, Dhaka",
        isLive: false,
      },
    ],
    squads: [],
    venues: [],
  } satisfies TourDetailSnapshot;

  const issues = auditTourDetailSnapshot(detail, {
    referenceDate: new Date("2026-06-10T00:00:00.000Z"),
  });

  assert.ok(issues.some((issue) => issue.code === "missing-venue-guides"));
});

test("committed Australia tour snapshot passes audit", async () => {
  const { readTourDetailSnapshot } = await import("../../lib/cricket/tour-detail-store.ts");
  const detail = await readTourDetailSnapshot("australia-tour-of-bangladesh-1532475");

  assert.ok(detail, "expected australia tour entry in tour detail store");

  const issues = auditTourDetailSnapshot(detail, {
    referenceDate: new Date("2026-06-20T12:00:00.000Z"),
  });

  assert.deepEqual(
    issues,
    [],
    issues.length ? formatTourDetailAuditIssues(issues).join("\n") : undefined,
  );
});

test("job-written tour snapshots do not attach the wrong ESPN series to a tour", () => {
  const raw = readFileSync(join(root, "data/tour-details.json"), "utf8");
  const file = JSON.parse(raw) as { entries: Record<string, TourDetailSnapshot> };

  for (const [slug, detail] of Object.entries(file.entries ?? {})) {
    const issues = auditTourDetailSnapshot(detail, {
      referenceDate: new Date("2026-06-20T12:00:00.000Z"),
    }).filter((issue) => issue.code === "series-id-mismatch" || issue.code === "host-venue-mismatch");

    assert.deepEqual(
      issues,
      [],
      `${slug}: ${formatTourDetailAuditIssues(issues).join("; ")}`,
    );
  }
});

test("tour detail read path does not import live ESPN series builder", () => {
  const source = readFileSync(join(root, "lib/cricket/services/tour-detail.ts"), "utf8");

  assert.doesNotMatch(source, /buildTourMatchesFromEspnSeries/);
  assert.doesNotMatch(source, /buildMatchesFromCuratedFixtures/);
});

test("deduplicateTours keeps max format counts instead of summing duplicate API rows", () => {
  const merged = deduplicateTours([
    {
      id: "1",
      name: "Australia tour of Bangladesh, 2026",
      startDate: "2026-06-09",
      endDate: "2026-06-21",
      odi: 3,
      t20: 3,
    },
    {
      id: "2",
      name: "Australia in Bangladesh ODI Series",
      startDate: "2026-06-09",
      odi: 3,
    },
    {
      id: "3",
      name: "Australia in Bangladesh T20I Series",
      startDate: "2026-06-17",
      t20: 3,
    },
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.odi, 3);
  assert.equal(merged[0]?.t20, 3);
});

test("tourSeasonKey keeps separate seasons apart", () => {
  assert.notEqual(
    tourSeasonKey({ name: "Australia tour of Bangladesh, 2024", startDate: "2024-08-01" }),
    tourSeasonKey({ name: "Australia tour of Bangladesh, 2026", startDate: "2026-06-09" }),
  );
});

test("applyFormatCountsFromMatches drives the tour header from fixtures", () => {
  const tour = {
    id: "1532475",
    name: "Australia tour of Bangladesh, 2026",
    odi: 9,
    t20: 11,
  } satisfies Tour;

  const matches = [
    { id: "1", name: "1st ODI", matchType: "odi", status: "won", isLive: false },
    { id: "2", name: "2nd ODI", matchType: "odi", status: "won", isLive: false },
    { id: "3", name: "3rd ODI", matchType: "odi", status: "won", isLive: false },
    { id: "4", name: "1st T20I", matchType: "t20", status: "won", isLive: false },
    { id: "5", name: "2nd T20I", matchType: "t20", status: "won", isLive: false },
    { id: "6", name: "3rd T20I", matchType: "t20", status: "won", isLive: false },
  ] satisfies LiveMatchSummary[];

  const updated = applyFormatCountsFromMatches(tour, matches);
  assert.equal(updated.odi, 3);
  assert.equal(updated.t20, 3);
  assert.equal(updated.matches, 6);
});

test("matchWithinTourWindow rejects fixtures outside the tour dates", () => {
  const tour = {
    id: "1532475",
    name: "Australia tour of Bangladesh, 2026",
    startDate: "2026-06-09",
    endDate: "2026-06-21",
  } satisfies Tour;

  const current = {
    id: "1",
    name: "1st ODI",
    date: "2026-06-09",
    status: "won",
    isLive: false,
  } satisfies LiveMatchSummary;

  const old = {
    id: "2",
    name: "1st ODI",
    date: "2024-08-20",
    status: "won",
    isLive: false,
  } satisfies LiveMatchSummary;

  assert.equal(matchWithinTourWindow(current, tour), true);
  assert.equal(matchWithinTourWindow(old, tour), false);
});

test("espnFixturesLookComplete trusts ESPN when tour metadata over-counts formats", () => {
  const tour = {
    id: "1532475",
    name: "Australia tour of Bangladesh, 2026",
    odi: 9,
    t20: 11,
  } satisfies Tour;

  const espnMatches = [
    { id: "1", name: "1st ODI", matchType: "odi", status: "won", isLive: false },
    { id: "2", name: "2nd ODI", matchType: "odi", status: "won", isLive: false },
    { id: "3", name: "3rd ODI", matchType: "odi", status: "won", isLive: false },
    { id: "4", name: "1st T20I", matchType: "t20", status: "won", isLive: false },
    { id: "5", name: "2nd T20I", matchType: "t20", status: "won", isLive: false },
    { id: "6", name: "3rd T20I", matchType: "t20", status: "won", isLive: false },
  ] satisfies LiveMatchSummary[];

  assert.equal(expectedTourFixtureCount(tour), 20);
  assert.equal(espnFixturesLookComplete(tour, espnMatches), true);
});

test("espnFixturesLookComplete still falls back when ESPN schedule is genuinely incomplete", () => {
  const tour = {
    id: "123",
    name: "Bangladesh tour of South Africa, 2026",
    startDate: "2026-11-15",
    endDate: "2026-12-13",
    test: 2,
    odi: 3,
    t20: 3,
  } satisfies Tour;

  assert.equal(
    espnFixturesLookComplete(tour, [
      { id: "1", name: "3rd T20I", matchType: "t20", status: "upcoming", isLive: false },
    ]),
    false,
  );
});

test("mergeTourFixtures keeps CricAPI schedule and overlays ESPN results", () => {
  const espn = [
    {
      id: "espn-1",
      name: "3rd T20I, at Centurion",
      status: "Bangladesh won by 5 wickets",
      venue: "SuperSport Park, Centurion",
      date: "2026-12-13",
      matchType: "t20",
      isLive: false,
    },
  ] satisfies LiveMatchSummary[];

  const cricapi = [
    ...Array.from({ length: 13 }, (_, index) => ({
      id: `cric-${index}`,
      name: `${index + 1}st Match`,
      status: "Match starts at 06:00 GMT",
      date: `2026-11-${String(15 + index).padStart(2, "0")}`,
      isLive: false,
    })),
    {
      id: "cric-13",
      name: "3rd T20I, at Centurion",
      status: "Match starts at 06:00 GMT",
      venue: "SuperSport Park, Centurion",
      date: "2026-12-13",
      matchType: "t20",
      isLive: false,
    },
  ] satisfies LiveMatchSummary[];

  const merged = mergeTourFixtures(espn, cricapi);

  assert.equal(merged.length, 14);
  assert.match(merged[13]?.status ?? "", /won by 5 wickets/i);
});
