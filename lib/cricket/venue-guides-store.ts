import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { canWriteProjectDataFiles } from "@/lib/cricket/can-write-data";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import { readCricketSnapshot, upsertCricketSnapshot } from "@/lib/cricket/snapshot-db";
import type { VenueGuide } from "@/lib/cricket/venues";
import { isPayloadConfigured } from "@/lib/payload-env";

export const VENUE_GUIDES_DATA_PATH = path.join(process.cwd(), "data", "venue-guides.json");
const VENUE_GUIDES_SEED_PATH = path.join(process.cwd(), "data-seed", "venue-guides.json");

export type VenueGuidesSnapshot = {
  fetchedAt: string;
  entries: Record<string, VenueGuide>;
};

const EMPTY: VenueGuidesSnapshot = { fetchedAt: "", entries: {} };

export function venueGuideKey(venueName: string): string {
  return venueName.trim().toLowerCase();
}

async function readVenueGuidesFile(filePath: string): Promise<VenueGuidesSnapshot> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as VenueGuidesSnapshot;
  } catch {
    return { ...EMPTY, entries: {} };
  }
}

function mergeVenueGuideSnapshots(...snapshots: VenueGuidesSnapshot[]): VenueGuidesSnapshot {
  const entries: Record<string, VenueGuide> = {};

  for (const snapshot of snapshots) {
    for (const [key, guide] of Object.entries(snapshot.entries ?? {})) {
      entries[key] = guide;
    }
  }

  const fetchedAt = snapshots
    .map((snapshot) => snapshot.fetchedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return { fetchedAt: fetchedAt ?? "", entries };
}

/** Read venue guides from seed, job JSON, and DB snapshot (in that merge order). */
export async function readVenueGuidesSnapshot(): Promise<VenueGuidesSnapshot> {
  const seed = await readVenueGuidesFile(VENUE_GUIDES_SEED_PATH);
  const volume = await readVenueGuidesFile(VENUE_GUIDES_DATA_PATH);
  let merged = mergeVenueGuideSnapshots(seed, volume);

  if (isPayloadConfigured()) {
    const fromDb = await readCricketSnapshot<VenueGuidesSnapshot>(CRICKET_SNAPSHOT_KEYS.venueGuides);
    if (fromDb?.entries) {
      merged = mergeVenueGuideSnapshots(merged, fromDb);
    }
  }

  return merged;
}

async function writeVenueGuidesFile(snapshot: VenueGuidesSnapshot): Promise<void> {
  if (!canWriteProjectDataFiles()) return;

  await mkdir(path.dirname(VENUE_GUIDES_DATA_PATH), { recursive: true });
  await writeFile(VENUE_GUIDES_DATA_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

/** Persist the full venue guide index — called by sync jobs when new grounds are discovered. */
export async function persistVenueGuidesSnapshot(snapshot: VenueGuidesSnapshot): Promise<void> {
  await writeVenueGuidesFile(snapshot);

  if (isPayloadConfigured()) {
    await upsertCricketSnapshot(
      CRICKET_SNAPSHOT_KEYS.venueGuides,
      "Cricket venue and host city guides",
      snapshot,
    );
  }
}

export async function upsertVenueGuides(guides: VenueGuide[]): Promise<void> {
  if (!guides.length) return;

  const snapshot = await readVenueGuidesSnapshot();
  let changed = false;

  for (const guide of guides) {
    const key = venueGuideKey(guide.venueName);
    const existing = snapshot.entries[key];
    if (
      existing &&
      existing.city === guide.city &&
      existing.about === guide.about &&
      existing.cityAbout === guide.cityAbout &&
      existing.weather === guide.weather
    ) {
      continue;
    }
    snapshot.entries[key] = guide;
    changed = true;
  }

  if (!changed) return;

  snapshot.fetchedAt = new Date().toISOString();
  await persistVenueGuidesSnapshot(snapshot);
}
