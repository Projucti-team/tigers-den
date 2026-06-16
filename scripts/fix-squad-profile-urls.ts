/**
 * Validate and rewrite squad player profile URLs in data/espn-tour-squads.json.
 * Usage: npx tsx scripts/fix-squad-profile-urls.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  enrichSquadPlayers,
  isProfileUrlForPlayer,
  squadPlayerDisplayName,
} from "../lib/cricket/squads/profile-urls";
import type { EspnTourSquadsSnapshot } from "../lib/cricket/squads/store";

const JSON_PATH = path.join(process.cwd(), "data", "espn-tour-squads.json");

async function main() {
  const raw = await readFile(JSON_PATH, "utf8");
  const snapshot = JSON.parse(raw) as EspnTourSquadsSnapshot;
  let fixed = 0;
  let checked = 0;

  for (const entry of Object.values(snapshot.entries)) {
    for (const squad of entry.squads) {
      const before = squad.players.map((p) => p.profileUrl ?? "");
      squad.players = await enrichSquadPlayers(squad.players);

      for (let i = 0; i < squad.players.length; i += 1) {
        const player = squad.players[i];
        checked += 1;
        const name = squadPlayerDisplayName(player.name);
        const ok = player.profileUrl
          ? await isProfileUrlForPlayer(name, player.profileUrl)
          : false;
        if (!ok) {
          console.warn(`  unresolved: ${name}`);
          continue;
        }
        if (before[i] !== player.profileUrl) {
          fixed += 1;
          console.log(`  fixed ${name}`);
          console.log(`    ${before[i] || "(none)"}`);
          console.log(`    ${player.profileUrl}`);
        }
      }
    }
  }

  snapshot.fetchedAt = new Date().toISOString();
  await writeFile(JSON_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Checked ${checked} players, updated ${fixed} profile URLs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
