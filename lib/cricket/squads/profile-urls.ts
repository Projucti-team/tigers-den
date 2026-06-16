import { findCricinfoPlayerId } from "@/lib/cricket/providers/cricinfo-player";
import { withCache } from "@/lib/cricket/cache";
import { cricinfoPlayerUrl, type SquadPlayer } from "@/lib/cricket/squads/types";

const CORE_ATHLETE_URL = "http://core.espnuk.org/v2/sports/cricket/athletes";
const CORE_TEAM_ATHLETES_URL = "http://core.espnuk.org/v2/sports/cricket/teams";
import { espnTeamIdsFromSeeds } from "@/lib/cricket/players/countries-seed";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type CoreList = { items?: { $ref: string }[] };

type RosterEntry = { name: string; url: string };

let teamRosterIndexPromise: Promise<RosterEntry[]> | null = null;

type CoreAthleteLink = {
  rel?: string[];
  href?: string;
};

export type CoreAthleteProfile = {
  id?: string;
  fullName?: string;
  displayName?: string;
  links?: CoreAthleteLink[];
};

export function squadPlayerDisplayName(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, "").trim() || name;
}

export function extractCricinfoPlayerId(profileUrl: string): number | null {
  const match = profileUrl.match(/\/cricketers\/[^/]+-(\d+)(?:\/|$)/) ?? profileUrl.match(/\/player\/(\d+)\.html/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

export async function fetchCoreAthleteProfile(id: number): Promise<CoreAthleteProfile | null> {
  try {
    const res = await fetch(`${CORE_ATHLETE_URL}/${id}`, {
      headers: { "User-Agent": BROWSER_USER_AGENT },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as CoreAthleteProfile;
  } catch {
    return null;
  }
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(candidate: string, target: string): boolean {
  const a = normalizeName(candidate);
  const b = normalizeName(target);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const aParts = a.split(" ");
  const bParts = b.split(" ");
  return aParts[0] === bParts[0] && aParts[aParts.length - 1] === bParts[bParts.length - 1];
}

/** Build a canonical Cricinfo profile URL from a core athlete payload. */
function indexRosterName(entries: RosterEntry[], name: string, url: string): void {
  const key = normalizeName(name);
  if (!key || entries.some((entry) => normalizeName(entry.name) === key)) return;
  entries.push({ name, url });
}

async function fetchTeamRosterIndex(): Promise<RosterEntry[]> {
  const entries: RosterEntry[] = [];

  for (const teamId of espnTeamIdsFromSeeds()) {
    const list = await fetch(`${CORE_TEAM_ATHLETES_URL}/${teamId}/athletes?limit=200`, {
      headers: { "User-Agent": BROWSER_USER_AGENT },
      cache: "no-store",
    })
      .then((res) => (res.ok ? (res.json() as Promise<CoreList>) : { items: [] }))
      .catch(() => ({ items: [] } as CoreList));

    for (const item of list.items ?? []) {
      const athlete = await fetch(item.$ref, {
        headers: { "User-Agent": BROWSER_USER_AGENT },
        cache: "no-store",
      })
        .then((res) => (res.ok ? (res.json() as Promise<CoreAthleteProfile>) : null))
        .catch(() => null);

      if (!athlete) continue;
      const url = profileUrlFromCoreAthlete(athlete);
      if (!url) continue;

      const label = athlete.fullName ?? athlete.displayName ?? "";
      indexRosterName(entries, label, url);
    }
  }

  return entries;
}

async function teamRosterProfileUrl(playerName: string): Promise<string | null> {
  if (!teamRosterIndexPromise) {
    teamRosterIndexPromise = withCache("cricinfo-team-roster-index", 24 * 60 * 60 * 1000, fetchTeamRosterIndex);
  }

  const entries = await teamRosterIndexPromise;
  const cleanName = squadPlayerDisplayName(playerName);
  for (const entry of entries) {
    if (namesMatch(entry.name, cleanName)) return entry.url;
  }

  return null;
}

export function profileUrlFromCoreAthlete(athlete: CoreAthleteProfile): string | null {
  const playercard = athlete.links?.find((link) => link.rel?.includes("playercard"))?.href;
  const idFromLink = playercard ? extractCricinfoPlayerId(playercard) : null;
  const id = idFromLink ?? Number(athlete.id);
  if (!Number.isFinite(id)) return null;

  const label = athlete.fullName ?? athlete.displayName ?? "player";
  return cricinfoPlayerUrl(id, label);
}

export async function resolveCricinfoPlayerProfileUrl(playerName: string): Promise<string | null> {
  const cleanName = squadPlayerDisplayName(playerName);
  return withCache(`cricinfo-profile:${cleanName.toLowerCase()}`, 7 * 24 * 60 * 60 * 1000, async () => {
    const fromRoster = await teamRosterProfileUrl(cleanName);
    if (fromRoster) return fromRoster;

    const id = await findCricinfoPlayerId(cleanName);
    if (!id) return null;

    const athlete = await fetchCoreAthleteProfile(id);
    if (athlete) {
      const fromAthlete = profileUrlFromCoreAthlete(athlete);
      if (fromAthlete) return fromAthlete;
    }

    return cricinfoPlayerUrl(id, cleanName);
  });
}

export async function isProfileUrlForPlayer(
  playerName: string,
  profileUrl: string,
): Promise<boolean> {
  const id = extractCricinfoPlayerId(profileUrl);
  if (!id) return false;

  const athlete = await fetchCoreAthleteProfile(id);
  if (!athlete?.fullName && !athlete?.displayName) return false;

  const candidate = athlete.fullName ?? athlete.displayName ?? "";
  return namesMatch(candidate, squadPlayerDisplayName(playerName));
}

export async function enrichSquadPlayer(player: SquadPlayer): Promise<SquadPlayer> {
  const name = squadPlayerDisplayName(player.name);
  if (player.profileUrl && (await isProfileUrlForPlayer(name, player.profileUrl))) {
    return player;
  }

  const resolved = await resolveCricinfoPlayerProfileUrl(name);
  return resolved ? { ...player, profileUrl: resolved } : { ...player, profileUrl: undefined };
}

export async function enrichSquadPlayers(players: SquadPlayer[]): Promise<SquadPlayer[]> {
  const enriched: SquadPlayer[] = [];
  for (const player of players) {
    enriched.push(await enrichSquadPlayer(player));
  }
  return enriched;
}
