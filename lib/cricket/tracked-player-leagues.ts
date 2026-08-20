import { readFile } from "node:fs/promises";
import path from "node:path";

import { getPayloadClient } from "@/lib/payload";
import { isPayloadConfigured } from "@/lib/payload-env";

const DATA_PATH = path.join(process.cwd(), "data", "tracked-player-leagues.json");

export type TrackedPlayerLeagueEntry = {
  id?: string | number;
  playerCricinfoUrl: string;
  teamCricinfoUrl: string;
  /** Everything below is resolved by the sync job (lib/cricket/services/sync-tracked-domestic-players.ts). */
  playerName?: string | null;
  teamName?: string | null;
  leagueName?: string | null;
  espnLeagueId?: number | null;
  athleteId?: number | null;
  teamId?: number | null;
  lastResolvedAt?: string | null;
  active?: boolean | null;
};

type TrackedPlayerLeaguesFile = {
  entries: TrackedPlayerLeagueEntry[];
};

export type TrackedLeagueRef = {
  espnLeagueId: number;
  cricinfoSeriesId?: number;
  seasonYear?: number;
  useSeasonEvents?: boolean;
  tourName?: string;
  kind: "international" | "domestic";
  trackedTeamName?: string;
  trackedPlayerName?: string;
  leagueDisplayName?: string;
  /** ESPN Core team id, resolved directly from the team's cricinfo link — preferred over name matching. */
  trackedTeamId?: number;
  /** ESPN Core athlete id, resolved directly from the player's cricinfo link — used to verify the
   * tracked player is actually in a match's playing XI before showing it as live/completed. */
  trackedAthleteId?: number;
};

async function readFileEntries(): Promise<TrackedPlayerLeagueEntry[]> {
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    const data = JSON.parse(raw) as TrackedPlayerLeaguesFile;
    return data.entries ?? [];
  } catch {
    return [];
  }
}

async function readPayloadEntries(
  options?: { activeOnly?: boolean },
): Promise<TrackedPlayerLeagueEntry[]> {
  if (!isPayloadConfigured()) return [];

  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "tracked-player-leagues",
      limit: 100,
      ...(options?.activeOnly === false ? {} : { where: { active: { equals: true } } }),
      overrideAccess: true,
    });

    return result.docs.map((doc) => ({
      id: doc.id,
      playerCricinfoUrl: String(doc.playerCricinfoUrl ?? ""),
      teamCricinfoUrl: String(doc.teamCricinfoUrl ?? ""),
      playerName: doc.playerName ? String(doc.playerName) : null,
      teamName: doc.teamName ? String(doc.teamName) : null,
      leagueName: doc.leagueName ? String(doc.leagueName) : null,
      espnLeagueId: doc.espnLeagueId ? Number(doc.espnLeagueId) : null,
      athleteId: doc.athleteId ? Number(doc.athleteId) : null,
      teamId: doc.teamId ? Number(doc.teamId) : null,
      lastResolvedAt: doc.lastResolvedAt ? String(doc.lastResolvedAt) : null,
      active: doc.active !== false,
    }));
  } catch {
    return [];
  }
}

/** Active player-league rows from Payload admin (falls back to data file in dev). */
export async function getTrackedPlayerLeagueEntries(): Promise<TrackedPlayerLeagueEntry[]> {
  const fromPayload = await readPayloadEntries();
  if (fromPayload.length) return fromPayload.filter((e) => e.active !== false);
  return (await readFileEntries()).filter((e) => e.active !== false);
}

/** Every row regardless of active flag — used by the sync job so a newly pasted (not-yet-active)
 * entry still gets its display name / league resolved and visible in admin right away. */
export async function getAllTrackedPlayerLeagueEntries(): Promise<TrackedPlayerLeagueEntry[]> {
  const fromPayload = await readPayloadEntries({ activeOnly: false });
  if (fromPayload.length) return fromPayload;
  return readFileEntries();
}

/**
 * Only entries the sync job has actually resolved (espnLeagueId set) are scannable — a freshly
 * pasted pair of links sits inactive until the next "Bangladesh schedule" run resolves it.
 */
export function trackedPlayerLeaguesToRefs(
  entries: TrackedPlayerLeagueEntry[],
): TrackedLeagueRef[] {
  return entries
    .filter((e) => Number.isFinite(e.espnLeagueId) && (e.espnLeagueId ?? 0) > 0)
    .map((e) => ({
      espnLeagueId: e.espnLeagueId as number,
      seasonYear: new Date().getFullYear(),
      useSeasonEvents: true,
      tourName: e.leagueName ?? undefined,
      kind: "domestic" as const,
      trackedTeamName: e.teamName ?? undefined,
      trackedPlayerName: e.playerName ?? undefined,
      leagueDisplayName: e.leagueName ?? undefined,
      trackedTeamId: e.teamId ?? undefined,
      trackedAthleteId: e.athleteId ?? undefined,
    }));
}

export function playerLeagueBannerTitle(entry: TrackedPlayerLeagueEntry): string {
  return `${entry.playerName ?? "Tracked player"} is playing for ${entry.teamName ?? "their team"}`;
}

export function teamNameMatches(teamLabel: string, trackedTeam: string): boolean {
  const team = teamLabel.toLowerCase().trim();
  const needle = trackedTeam.toLowerCase().trim();
  if (!team || !needle) return false;
  if (team === needle) return true;
  if (team.includes(needle) || needle.includes(team)) return true;
  const teamWord = team.split(/\s+/)[0];
  const needleWord = needle.split(/\s+/)[0];
  return teamWord.length >= 3 && teamWord === needleWord;
}
