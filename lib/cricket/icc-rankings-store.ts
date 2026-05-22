import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { IccRankingsSnapshot } from "@/lib/cricket/providers/icc-sportz";

export const ICC_RANKINGS_DATA_PATH = path.join(process.cwd(), "data", "icc-rankings.json");

export async function readIccRankingsSnapshot(): Promise<IccRankingsSnapshot | null> {
  try {
    const raw = await readFile(ICC_RANKINGS_DATA_PATH, "utf8");
    const data = JSON.parse(raw) as IccRankingsSnapshot;
    if (!data?.men || !data?.women || !data.fetchedAt) return null;
    return data;
  } catch {
    return null;
  }
}

export async function writeIccRankingsSnapshot(snapshot: IccRankingsSnapshot): Promise<void> {
  await mkdir(path.dirname(ICC_RANKINGS_DATA_PATH), { recursive: true });
  await writeFile(ICC_RANKINGS_DATA_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export function snapshotAgeHours(snapshot: IccRankingsSnapshot): number {
  const ageMs = Date.now() - new Date(snapshot.fetchedAt).getTime();
  return ageMs / (1000 * 60 * 60);
}
