import assert from "node:assert/strict";
import test from "node:test";

import { lookupVenueGuide } from "../../lib/cricket/venues.ts";

/**
 * Regression test: "Marrara Oval, Darwin" (the Bangladesh vs Australia Darwin Test venue) was
 * showing Kia Oval/London's guide content -- the Kia Oval pattern was a bare /oval|kennington/i,
 * which matches any ground with "Oval" in its name (Marrara Oval, Adelaide Oval, Queen's Park
 * Oval, etc.), not just Kia Oval specifically.
 */
test("Marrara Oval gets its own Darwin guide, not Kia Oval's London content", () => {
  const guide = lookupVenueGuide("Marrara Oval, Darwin");
  assert.equal(guide.city, "Darwin");
  assert.match(guide.about, /Marrara|Darwin/i);
  assert.doesNotMatch(guide.about, /Kia Oval|London/i);
});

test("Kia Oval itself still resolves correctly", () => {
  const guide = lookupVenueGuide("Kia Oval, London");
  assert.equal(guide.city, "London");
  assert.match(guide.about, /Kia Oval/i);
});

test("other 'Oval' grounds don't collide with Kia Oval either", () => {
  const adelaide = lookupVenueGuide("Adelaide Oval");
  assert.notEqual(adelaide.city, "London");
  assert.doesNotMatch(adelaide.about, /Kia Oval/i);

  // Kensington Oval already had its own specific entry -- confirm it still wins over Kia Oval's.
  const kensington = lookupVenueGuide("Kensington Oval, Barbados");
  assert.equal(kensington.city, "Bridgetown, Barbados");
});
