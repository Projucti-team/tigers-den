import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { formatMatchStatus } from "../../lib/cricket/datetime-bd.ts";
import { sanitizeTourSnapshotForRead } from "../../lib/cricket/tour-detail-sanitize.ts";
import {
  filterMatchesForTour,
  matchVenueMatchesTourHost,
  parseTourTeamsFromName,
  squadBelongsToTour,
  tourNamesShareVenue,
  tourVenueKey,
} from "../../lib/cricket/tour-identity.ts";
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
  assert.equal(sanitized.squads.length, 0);
  assert.equal(sanitized.venues.length, 0);
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
