import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { canWriteProjectDataFiles } from "@/lib/cricket/can-write-data";
import type { WtcStandingsSnapshot } from "@/lib/cricket/types";

export const WTC_STANDINGS_DATA_PATH = path.join(process.cwd(), "data", "wtc-standings.json");

export async function readWtcStandingsSnapshot(): Promise<WtcStandingsSnapshot | null> {
  try {
    const raw = await readFile(WTC_STANDINGS_DATA_PATH, "utf8");
    const data = JSON.parse(raw) as WtcStandingsSnapshot;
    if (!data?.fetchedAt || !Array.isArray(data.standings)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function writeWtcStandingsSnapshot(snapshot: WtcStandingsSnapshot): Promise<void> {
  if (!canWriteProjectDataFiles()) return;

  await mkdir(path.dirname(WTC_STANDINGS_DATA_PATH), { recursive: true });
  await writeFile(WTC_STANDINGS_DATA_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export function wtcSnapshotAgeHours(snapshot: WtcStandingsSnapshot): number {
  const ageMs = Date.now() - new Date(snapshot.fetchedAt).getTime();
  return ageMs / (1000 * 60 * 60);
}
