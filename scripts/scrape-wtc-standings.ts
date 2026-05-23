/**
 * World Test Championship standings (ESPN Cricinfo core API).
 *
 * Usage: npm run scrape:wtc-standings
 */
import { fetchWtcStandingsFromEspn } from "../lib/cricket/providers/wtc-espn";
import { writeWtcStandingsSnapshot, WTC_STANDINGS_DATA_PATH } from "../lib/cricket/wtc-store";
import { isBangladeshTeam } from "../lib/cricket/constants";

async function main() {
  console.log("Fetching WTC standings from ESPN Cricinfo core API…");
  const snapshot = await fetchWtcStandingsFromEspn();
  await writeWtcStandingsSnapshot(snapshot);
  console.log(`Saved to ${WTC_STANDINGS_DATA_PATH}`);
  console.log(`Fetched at: ${snapshot.fetchedAt} (${snapshot.cycleLabel})`);

  const bd = snapshot.standings.find(
    (t) => isBangladeshTeam(t.team) || t.abbreviation.toUpperCase() === "BAN",
  );
  if (bd) {
    console.log(`  Bangladesh: #${bd.rank} — ${bd.pct}% PCT (${bd.won}W ${bd.lost}L ${bd.drawn}D)`);
  }
  console.log(`  Teams: ${snapshot.standings.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
