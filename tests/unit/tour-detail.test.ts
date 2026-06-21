import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { formatMatchStatus } from "../../lib/cricket/datetime-bd.ts";
import { parseTourTeamsFromName } from "../../lib/cricket/tour-identity.ts";
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
    }).filter((issue) => issue.code === "series-id-mismatch");

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
