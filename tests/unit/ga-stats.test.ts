import assert from "node:assert/strict";
import test from "node:test";

import { parseTopPages } from "../../lib/analytics/ga-stats.ts";

test("parseTopPages sorts by views descending and respects the limit", () => {
  const report = {
    rows: [
      { dimensionValues: [{ value: "/match-centre" }], metricValues: [{ value: "42" }] },
      { dimensionValues: [{ value: "/" }], metricValues: [{ value: "310" }] },
      { dimensionValues: [{ value: "/rankings" }], metricValues: [{ value: "128" }] },
    ],
  };

  const top = parseTopPages(report, 2);

  assert.deepEqual(
    top.map((p) => p.path),
    ["/", "/rankings"],
  );
  assert.equal(top[0].views, 310);
});

test("parseTopPages handles a missing/empty report without throwing", () => {
  assert.deepEqual(parseTopPages(null), []);
  assert.deepEqual(parseTopPages(undefined), []);
  assert.deepEqual(parseTopPages({ rows: [] }), []);
});

test("parseTopPages falls back to (unknown) for a row with no dimension value", () => {
  const report = { rows: [{ dimensionValues: [], metricValues: [{ value: "5" }] }] };
  const top = parseTopPages(report);
  assert.equal(top[0].path, "(unknown)");
  assert.equal(top[0].views, 5);
});
