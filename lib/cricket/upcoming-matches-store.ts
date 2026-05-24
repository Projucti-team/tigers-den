import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { LiveMatchSummary } from "@/lib/cricket/types";

export const BANGLADESH_UPCOMING_MATCHES_PATH = path.join(
  process.cwd(),
  "data",
  "bangladesh-upcoming-matches.json",
);

export type BangladeshUpcomingMatchesSnapshot = {
  fetchedAt: string;
  source: string;
  matches: LiveMatchSummary[];
};

export async function readBangladeshUpcomingMatches(): Promise<BangladeshUpcomingMatchesSnapshot | null> {
  try {
    const raw = await readFile(BANGLADESH_UPCOMING_MATCHES_PATH, "utf8");
    const data = JSON.parse(raw) as BangladeshUpcomingMatchesSnapshot;
    if (!Array.isArray(data?.matches)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function writeBangladeshUpcomingMatches(
  snapshot: BangladeshUpcomingMatchesSnapshot,
): Promise<void> {
  await mkdir(path.dirname(BANGLADESH_UPCOMING_MATCHES_PATH), { recursive: true });
  await writeFile(
    BANGLADESH_UPCOMING_MATCHES_PATH,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );
}
