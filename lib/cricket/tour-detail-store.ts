import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { canWriteProjectDataFiles } from "@/lib/cricket/can-write-data";
import type { TourDetailSnapshot } from "@/lib/cricket/snapshot-types";

export const TOUR_DETAILS_DATA_PATH = path.join(process.cwd(), "data", "tour-details.json");
const TOUR_DETAILS_SEED_PATH = path.join(process.cwd(), "data-seed", "tour-details.json");

export type TourDetailsFileSnapshot = {
  fetchedAt: string;
  entries: Record<string, TourDetailSnapshot>;
};

const EMPTY: TourDetailsFileSnapshot = { fetchedAt: "", entries: {} };

async function readTourDetailsFile(filePath: string): Promise<TourDetailsFileSnapshot> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as TourDetailsFileSnapshot;
  } catch {
    return { ...EMPTY, entries: {} };
  }
}

function mergeTourDetailsSnapshots(
  volume: TourDetailsFileSnapshot,
  seed: TourDetailsFileSnapshot,
): TourDetailsFileSnapshot {
  const entries: Record<string, TourDetailSnapshot> = { ...(seed.entries ?? {}) };

  for (const [slug, detail] of Object.entries(volume.entries ?? {})) {
    entries[slug] = detail;
  }

  const fetchedAt = [volume.fetchedAt, seed.fetchedAt].filter(Boolean).sort().at(-1);

  return { fetchedAt: fetchedAt ?? "", entries };
}

async function readMergedTourDetailsFile(): Promise<TourDetailsFileSnapshot> {
  const seed = await readTourDetailsFile(TOUR_DETAILS_SEED_PATH);
  const volume = await readTourDetailsFile(TOUR_DETAILS_DATA_PATH);
  return mergeTourDetailsSnapshots(volume, seed);
}

/** Read a pre-built tour page from committed seed + job-written JSON. */
export async function readTourDetailSnapshot(slug: string): Promise<TourDetailSnapshot | null> {
  const snapshot = await readMergedTourDetailsFile();
  const detail = snapshot.entries[slug];
  if (!detail?.tour?.name || !detail.fetchedAt) return null;
  return detail;
}

/** Persist tour page data — written by cricket sync jobs only. */
export async function writeTourDetailSnapshot(
  slug: string,
  detail: TourDetailSnapshot,
): Promise<void> {
  if (!canWriteProjectDataFiles()) return;

  let snapshot = await readTourDetailsFile(TOUR_DETAILS_DATA_PATH);
  snapshot.entries[slug] = detail;
  snapshot.fetchedAt = new Date().toISOString();

  await mkdir(path.dirname(TOUR_DETAILS_DATA_PATH), { recursive: true });
  await writeFile(TOUR_DETAILS_DATA_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

/** Drop tour pages that are no longer in the upcoming tours index. */
export async function pruneTourDetailSnapshots(slugsToKeep: Set<string>): Promise<number> {
  if (!canWriteProjectDataFiles()) return 0;

  const snapshot = await readTourDetailsFile(TOUR_DETAILS_DATA_PATH);
  let removed = 0;

  for (const slug of Object.keys(snapshot.entries)) {
    if (slugsToKeep.has(slug)) continue;
    delete snapshot.entries[slug];
    removed += 1;
  }

  if (removed > 0) {
    snapshot.fetchedAt = new Date().toISOString();
    await mkdir(path.dirname(TOUR_DETAILS_DATA_PATH), { recursive: true });
    await writeFile(TOUR_DETAILS_DATA_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  }

  return removed;
}
