import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import type { SeriesSquad } from "@/lib/cricket/squads/types";

export const ESPN_TOUR_SQUADS_PATH = path.join(process.cwd(), "data", "espn-tour-squads.json");

export type EspnTourSquadsEntry = {
  tourName: string;
  cricinfoSeriesId?: number;
  espnLeagueId?: number;
  fetchedAt: string;
  squads: SeriesSquad[];
};

export type EspnTourSquadsSnapshot = {
  fetchedAt: string;
  entries: Record<string, EspnTourSquadsEntry>;
};

const EMPTY: EspnTourSquadsSnapshot = { fetchedAt: "", entries: {} };

export async function readEspnTourSquads(): Promise<EspnTourSquadsSnapshot> {
  try {
    const raw = await readFile(ESPN_TOUR_SQUADS_PATH, "utf8");
    return JSON.parse(raw) as EspnTourSquadsSnapshot;
  } catch {
    return { ...EMPTY };
  }
}

export async function writeEspnTourSquads(snapshot: EspnTourSquadsSnapshot): Promise<void> {
  await mkdir(path.dirname(ESPN_TOUR_SQUADS_PATH), { recursive: true });
  await writeFile(ESPN_TOUR_SQUADS_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export function lookupEspnTourSquads(
  snapshot: EspnTourSquadsSnapshot,
  keys: string[],
): SeriesSquad[] {
  for (const key of keys) {
    const entry = snapshot.entries[key];
    if (entry?.squads.length) return entry.squads;
  }
  return [];
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
