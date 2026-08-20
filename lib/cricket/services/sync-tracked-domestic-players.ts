import { parseCricinfoTrailingId } from "@/lib/cricket/cricinfo-links";
import { fetchEspnAthleteInfo, fetchEspnTeamInfo } from "@/lib/cricket/providers/espn-athletes-teams";
import { getAllTrackedPlayerLeagueEntries } from "@/lib/cricket/tracked-player-leagues";
import { getPayloadClient } from "@/lib/payload";
import { isPayloadConfigured } from "@/lib/payload-env";

/**
 * Resolves each admin-pasted (player link, team link) pair against ESPN's Core API: parses the
 * numeric id straight out of both cricinfo URLs (confirmed to match the Core API id directly, no
 * separate lookup needed), fetches display names, and picks the team's current-event league if
 * one is on right now, else its default league. Writes the resolved fields back onto the Payload
 * doc so trackedPlayerLeaguesToRefs() (lib/cricket/tracked-player-leagues.ts) has an espnLeagueId
 * to scan and an athleteId to verify the tracked player is actually in the playing XI.
 */
export async function syncTrackedDomesticPlayers(): Promise<{
  resolved: number;
  warnings: string[];
}> {
  const warnings: string[] = [];

  if (!isPayloadConfigured()) {
    return { resolved: 0, warnings: ["PAYLOAD_SECRET is not set"] };
  }

  const entries = await getAllTrackedPlayerLeagueEntries();
  if (!entries.length) return { resolved: 0, warnings: [] };

  const payload = await getPayloadClient();
  let resolved = 0;

  for (const entry of entries) {
    if (!entry.id) continue;

    const athleteId = parseCricinfoTrailingId(entry.playerCricinfoUrl ?? "");
    const teamId = parseCricinfoTrailingId(entry.teamCricinfoUrl ?? "");

    if (!athleteId || !teamId) {
      warnings.push(
        `Tracked player entry ${entry.id}: couldn't parse a player/team id from the pasted link(s).`,
      );
      continue;
    }

    const [athlete, team] = await Promise.all([
      fetchEspnAthleteInfo(athleteId),
      fetchEspnTeamInfo(teamId),
    ]);

    if (!athlete || !team) {
      warnings.push(
        `Tracked player entry ${entry.id}: ESPN didn't recognize ${!athlete ? "the player" : "the team"} link.`,
      );
      continue;
    }

    const espnLeagueId = team.currentEventLeagueId ?? team.defaultLeagueId ?? null;
    if (!espnLeagueId) {
      warnings.push(
        `Tracked player entry ${entry.id}: ${team.displayName} has no current or default competition on ESPN yet.`,
      );
    }

    try {
      await payload.update({
        collection: "tracked-player-leagues",
        id: entry.id,
        data: {
          athleteId,
          teamId,
          playerName: athlete.displayName,
          teamName: team.displayName,
          leagueName: `${team.displayName} — current competition`,
          espnLeagueId,
          lastResolvedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      });
      resolved += 1;
    } catch (e) {
      warnings.push(
        `Tracked player entry ${entry.id}: failed to save resolved data (${e instanceof Error ? e.message : "unknown error"}).`,
      );
    }
  }

  return { resolved, warnings };
}
