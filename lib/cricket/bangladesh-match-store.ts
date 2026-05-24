import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { canWriteProjectDataFiles } from "@/lib/cricket/can-write-data";
import type { MatchHighlight } from "@/lib/cricket/services/match-highlight";
import type { LiveMatchSummary } from "@/lib/cricket/types";

export const BANGLADESH_LAST_MATCH_PATH = path.join(
  process.cwd(),
  "data",
  "bangladesh-last-match.json",
);

export type BangladeshLastMatchSnapshot = {
  fetchedAt: string;
  source: string;
  highlight: MatchHighlight;
  raw?: LiveMatchSummary;
};

export async function readBangladeshLastMatch(): Promise<BangladeshLastMatchSnapshot | null> {
  try {
    const raw = await readFile(BANGLADESH_LAST_MATCH_PATH, "utf8");
    const data = JSON.parse(raw) as BangladeshLastMatchSnapshot;
    if (!data?.highlight?.title) return null;
    return data;
  } catch {
    return null;
  }
}

export async function writeBangladeshLastMatch(
  snapshot: BangladeshLastMatchSnapshot,
): Promise<void> {
  if (!canWriteProjectDataFiles()) return;

  await mkdir(path.dirname(BANGLADESH_LAST_MATCH_PATH), { recursive: true });
  await writeFile(
    BANGLADESH_LAST_MATCH_PATH,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );
}

export function snapshotAgeHours(snapshot: BangladeshLastMatchSnapshot): number {
  return (Date.now() - new Date(snapshot.fetchedAt).getTime()) / (1000 * 60 * 60);
}
