/**
 * Refresh tour squads from ESPNcricinfo (core API + story RSS).
 * Updates data/espn-tour-squads.json — run during nightly cricket sync or manually.
 *
 * Usage: npm run scrape:espn-squads
 */
import { refreshEspnTourSquads } from "../lib/cricket/providers/espn-squads";
import { readEspnTourSquads } from "../lib/cricket/squads/store";
import { getFutureTours } from "../lib/cricket/services/tours";

async function main() {
  const { tours } = await getFutureTours({ bangladeshOnly: true });
  console.log(`Refreshing ESPNcricinfo squads for ${tours.length} tour(s)…`);

  for (const tour of tours) {
    const { squads, warnings } = await refreshEspnTourSquads(tour);
    console.log(`  ${tour.name}: ${squads.length} squad(s)`);
    for (const w of warnings) console.log(`    ⚠ ${w}`);
  }

  const snapshot = await readEspnTourSquads();
  console.log(`Saved ${Object.keys(snapshot.entries).length} entries to data/espn-tour-squads.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
