import { readFile } from "node:fs/promises";
import path from "node:path";

import { getPayloadClient } from "@/lib/payload";
import { isPayloadConfigured } from "@/lib/payload-env";

const DATA_PATH = path.join(process.cwd(), "data", "tracked-player-leagues.json");

export type TrackedPlayerLeagueEntry = {
  id?: string | number;
  playerName: string;
  teamName: string;
  leagueName: string;
  espnLeagueId: number;
  cricinfoSeriesId?: number | null;
  seasonYear?: number | null;
  useSeasonEvents?: boolean | null;
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

async function readPayloadEntries(): Promise<TrackedPlayerLeagueEntry[]> {
  if (!isPayloadConfigured()) return [];

  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "tracked-player-leagues",
      limit: 100,
      where: { active: { equals: true } },
      overrideAccess: true,
    });

    return result.docs.map((doc) => ({
      id: doc.id,
      playerName: String(doc.playerName ?? ""),
      teamName: String(doc.teamName ?? ""),
      leagueName: String(doc.leagueName ?? ""),
      espnLeagueId: Number(doc.espnLeagueId),
      cricinfoSeriesId: doc.cricinfoSeriesId ? Number(doc.cricinfoSeriesId) : null,
      seasonYear: doc.seasonYear ? Number(doc.seasonYear) : null,
      useSeasonEvents: doc.useSeasonEvents !== false,
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

export function trackedPlayerLeaguesToRefs(
  entries: TrackedPlayerLeagueEntry[],
): TrackedLeagueRef[] {
  return entries
    .filter((e) => Number.isFinite(e.espnLeagueId) && e.espnLeagueId > 0)
    .map((e) => ({
      espnLeagueId: e.espnLeagueId,
      cricinfoSeriesId: e.cricinfoSeriesId ?? undefined,
      seasonYear: e.seasonYear ?? undefined,
      useSeasonEvents: e.useSeasonEvents !== false,
      tourName: e.leagueName,
      kind: "domestic" as const,
      trackedTeamName: e.teamName,
      trackedPlayerName: e.playerName,
      leagueDisplayName: e.leagueName,
    }));
}

export function playerLeagueBannerTitle(entry: TrackedPlayerLeagueEntry): string {
  return `${entry.playerName} is playing for ${entry.teamName}`;
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
