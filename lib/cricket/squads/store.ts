import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { mergeSquads, type SeriesSquad } from "@/lib/cricket/squads/types";

export const ESPN_TOUR_SQUADS_PATH = path.join(process.cwd(), "data", "espn-tour-squads.json");
const ESPN_TOUR_SQUADS_SEED_PATH = path.join(process.cwd(), "data-seed", "espn-tour-squads.json");

export type EspnTourSquadsEntry = {
  tourName: string;
  cricinfoSeriesId?: number;
  espnLeagueId?: number;
  /** Known ESPN story URLs to fetch when RSS/live discovery fails on the server. */
  squadStoryUrls?: string[];
  fetchedAt: string;
  squads: SeriesSquad[];
};

export type EspnTourSquadsSnapshot = {
  fetchedAt: string;
  entries: Record<string, EspnTourSquadsEntry>;
};

const EMPTY: EspnTourSquadsSnapshot = { fetchedAt: "", entries: {} };

async function readEspnTourSquadsFile(filePath: string): Promise<EspnTourSquadsSnapshot> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as EspnTourSquadsSnapshot;
  } catch {
    return { ...EMPTY };
  }
}

function mergeEspnTourSquadsSnapshots(
  ...snapshots: EspnTourSquadsSnapshot[]
): EspnTourSquadsSnapshot {
  const entries: Record<string, EspnTourSquadsEntry> = {};

  for (const snapshot of snapshots) {
    for (const [key, entry] of Object.entries(snapshot.entries)) {
      const existing = entries[key];
      if (!existing) {
        entries[key] = entry;
        continue;
      }
      entries[key] = {
        ...existing,
        ...entry,
        squadStoryUrls: [
          ...new Set([...(existing.squadStoryUrls ?? []), ...(entry.squadStoryUrls ?? [])]),
        ],
        squads: mergeSquads(existing.squads, entry.squads),
        fetchedAt: entry.fetchedAt || existing.fetchedAt,
      };
    }
  }

  const fetchedAt = snapshots
    .map((s) => s.fetchedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return { fetchedAt: fetchedAt ?? "", entries };
}

export async function readEspnTourSquads(): Promise<EspnTourSquadsSnapshot> {
  const seed = await readEspnTourSquadsFile(ESPN_TOUR_SQUADS_SEED_PATH);
  const volume = await readEspnTourSquadsFile(ESPN_TOUR_SQUADS_PATH);
  return mergeEspnTourSquadsSnapshots(seed, volume);
}

export async function writeEspnTourSquads(snapshot: EspnTourSquadsSnapshot): Promise<void> {
  await mkdir(path.dirname(ESPN_TOUR_SQUADS_PATH), { recursive: true });
  await writeFile(ESPN_TOUR_SQUADS_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export function lookupEspnTourSquads(
  snapshot: EspnTourSquadsSnapshot,
  keys: string[],
): SeriesSquad[] {
  const lists: SeriesSquad[][] = [];
  const seen = new Set<string>();

  for (const key of keys) {
    const entry = snapshot.entries[key];
    if (entry?.squads.length && !seen.has(key)) {
      lists.push(entry.squads);
      seen.add(key);
    }
  }

  return lists.length ? mergeSquads(...lists) : [];
}

export async function upsertEspnTourSquads(
  key: string,
  entry: Omit<EspnTourSquadsEntry, "fetchedAt"> & { fetchedAt?: string },
): Promise<void> {
  const snapshot = await readEspnTourSquads();
  snapshot.entries[key] = {
    ...entry,
    fetchedAt: entry.fetchedAt ?? new Date().toISOString(),
  };
  snapshot.fetchedAt = new Date().toISOString();
  await writeEspnTourSquads(snapshot);
}
