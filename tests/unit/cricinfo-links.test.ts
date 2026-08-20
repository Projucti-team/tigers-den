import assert from "node:assert/strict";
import test from "node:test";

import { parseCricinfoTrailingId } from "../../lib/cricket/cricinfo-links.ts";

/**
 * Confirmed live against ESPN's Core API (core.espnuk.org) during this feature's design: the
 * trailing number in both cricinfo URL shapes is the ESPN Core athlete/team id directly --
 * .../cricketers/hasan-mahmud-926629 -> athletes/926629 ("Hasan Mahmud"), .../team/kent-1098 ->
 * teams/1098 ("Kent"). This is the one bit of parsing the whole admin-link-based tracking feature
 * depends on.
 */
test("parseCricinfoTrailingId: extracts the id from a player profile URL", () => {
  assert.equal(
    parseCricinfoTrailingId("https://www.espncricinfo.com/cricketers/hasan-mahmud-926629"),
    926629,
  );
});

test("parseCricinfoTrailingId: extracts the id from a team profile URL", () => {
  assert.equal(parseCricinfoTrailingId("https://www.espncricinfo.com/team/kent-1098"), 1098);
});

test("parseCricinfoTrailingId: tolerates a trailing slash or query string", () => {
  assert.equal(parseCricinfoTrailingId("https://www.espncricinfo.com/team/kent-1098/"), 1098);
  assert.equal(
    parseCricinfoTrailingId("https://www.espncricinfo.com/team/kent-1098?tab=fixtures"),
    1098,
  );
});

test("parseCricinfoTrailingId: returns null for a link with no trailing id", () => {
  assert.equal(parseCricinfoTrailingId("https://www.espncricinfo.com/team/kent"), null);
  assert.equal(parseCricinfoTrailingId(""), null);
});

test("parseCricinfoTrailingId: doesn't get fooled by a hyphenated name segment before the real id", () => {
  assert.equal(
    parseCricinfoTrailingId("https://www.espncricinfo.com/cricketers/shakib-al-hasan-56143"),
    56143,
  );
});
