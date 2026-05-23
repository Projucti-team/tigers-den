import { withCache } from "@/lib/cricket/cache";
import { FORMATS_BY_GENDER } from "@/lib/cricket/constants";
import {
  isCricinfoPlaceholderPhoto,
  resolveCricinfoPlayerImageUrl,
} from "@/lib/cricket/providers/cricinfo-player";
import type { IccRankingsSnapshot } from "@/lib/cricket/providers/icc-sportz";
import type { RankedPlayer } from "@/lib/cricket/types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPlaceholderPhoto(url: string): boolean {
  return isCricinfoPlaceholderPhoto(url);
}

function avatarFallback(name: string): string {
  const encoded = encodeURIComponent(name.replace(/\s+/g, "+"));
  return `https://ui-avatars.com/api/?name=${encoded}&background=006a4e&color=fff&size=320&bold=true`;
}

/** Resolve player name → ESPN Cricinfo headshot (free), then initials fallback. */
export async function resolvePlayerImageUrl(playerName: string): Promise<string> {
  return withCache(`player-img:${playerName}`, 24 * 60 * 60 * 1000, async () => {
    try {
      const cricinfoUrl = await resolveCricinfoPlayerImageUrl(playerName);
      if (cricinfoUrl) return cricinfoUrl;
    } catch {
      /* fall through */
    }

    return avatarFallback(playerName);
  });
}

export async function enrichPlayerImage<T extends { name: string; imageUrl?: string }>(
  player: T | null,
): Promise<T | null> {
  if (!player) return null;
  if (player.imageUrl && !isPlaceholderPhoto(player.imageUrl)) return player;
  const imageUrl = await resolvePlayerImageUrl(player.name);
  return { ...player, imageUrl };
}

const BD_PLAYER_KEYS = [
  "topBangladeshBatsman",
  "topBangladeshBowler",
  "topBangladeshAllRounder",
] as const;

/** Bake photo URLs into data/icc-rankings.json (run via scrape — works on Vercel without API keys). */
export async function enrichIccSnapshotPlayerImages(
  snapshot: IccRankingsSnapshot,
): Promise<IccRankingsSnapshot> {
  const urlByName = new Map<string, string>();

  async function imageFor(player: RankedPlayer): Promise<RankedPlayer> {
    if (player.imageUrl && !isPlaceholderPhoto(player.imageUrl)) return player;

    let url = urlByName.get(player.name);
    if (!url) {
      url = await resolvePlayerImageUrl(player.name);
      urlByName.set(player.name, url);
      await sleep(300);
    }

    return { ...player, imageUrl: url };
  }

  for (const gender of ["men", "women"] as const) {
    for (const format of FORMATS_BY_GENDER[gender]) {
      const block = snapshot[gender].players[format];
      for (const key of BD_PLAYER_KEYS) {
        const player = block[key];
        if (player) block[key] = await imageFor(player);
      }
    }
  }

  return snapshot;
}
