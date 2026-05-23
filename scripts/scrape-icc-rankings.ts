/**
 * Nightly ICC rankings fetch — same JSON feed as https://www.icc-cricket.com/rankings
 *
 * Usage: npm run scrape:icc-rankings
 */
import { FORMATS_BY_GENDER } from "../lib/cricket/constants";
import { enrichIccSnapshotPlayerImages } from "../lib/cricket/player-images";
import { fetchAllIccRankingsFromSportz } from "../lib/cricket/providers/icc-sportz";
import { writeIccRankingsSnapshot, ICC_RANKINGS_DATA_PATH } from "../lib/cricket/icc-rankings-store";

async function main() {
  console.log("Fetching ICC rankings from Sportz.io (icc-cricket.com feed)…");
  let snapshot = await fetchAllIccRankingsFromSportz();

  console.log("Resolving Bangladesh player photos from ESPN Cricinfo…");
  snapshot = await enrichIccSnapshotPlayerImages(snapshot);

  await writeIccRankingsSnapshot(snapshot);
  console.log(`Saved to ${ICC_RANKINGS_DATA_PATH}`);
  console.log(`Fetched at: ${snapshot.fetchedAt}`);

  for (const gender of ["men", "women"] as const) {
    const data = snapshot[gender];
    for (const format of FORMATS_BY_GENDER[gender]) {
      const teams = data.teams[format]?.length ?? 0;
      const bat = data.players[format]?.topBatsmen?.length ?? 0;
      const bowl = data.players[format]?.topBowlers?.length ?? 0;
      console.log(`  ${gender} ${format}: ${teams} teams, ${bat} batters, ${bowl} bowlers`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
