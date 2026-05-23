import { withCache } from "@/lib/cricket/cache";
import { FORMATS_BY_GENDER } from "@/lib/cricket/constants";
import {
  iccPlayerImageUrl,
  isIccPlayerImageUrl,
  resolveIccPlayerImageUrl,
} from "@/lib/cricket/providers/icc-player";
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

function hasUsableImage(player: RankedPlayer): boolean {
  const url = player.imageUrl ?? "";
  if (!url || isPlaceholderPhoto(url)) return false;
  if (player.iccPlayerId && url.includes("a.espncdn.com")) return false;
  if (isIccPlayerImageUrl(url)) return true;
  return !url.includes("ui-avatars.com");
}

/** ICC headshot first, then Cricinfo, then initials. */
export async function resolvePlayerImageUrl(player: RankedPlayer | string): Promise<string> {
  const ranked = typeof player === "string" ? ({ name: player } as RankedPlayer) : player;
  const cacheKey = ranked.iccPlayerId
    ? `player-img:icc:${ranked.iccPlayerId}`
    : `player-img:${ranked.name}`;

  return withCache(cacheKey, 24 * 60 * 60 * 1000, async () => {
    if (ranked.iccPlayerId) {
      const iccUrl = await resolveIccPlayerImageUrl(ranked.iccPlayerId);
      if (iccUrl) return iccUrl;
    }

    try {
      const cricinfoUrl = await resolveCricinfoPlayerImageUrl(ranked.name);
      if (cricinfoUrl) return cricinfoUrl;
    } catch {
      /* fall through */
    }

    return avatarFallback(ranked.name);
  });
}

export async function enrichPlayerImage(player: RankedPlayer | null): Promise<RankedPlayer | null> {
  if (!player) return null;
  if (hasUsableImage(player)) return player;
  const imageUrl = await resolvePlayerImageUrl(player);
  return { ...player, imageUrl };
}

const BD_PLAYER_KEYS = [
  "topBangladeshBatsman",
  "topBangladeshBowler",
  "topBangladeshAllRounder",
] as const;

/** Bake ICC photo URLs into data/icc-rankings.json (run via scrape). */
export async function enrichIccSnapshotPlayerImages(
  snapshot: IccRankingsSnapshot,
): Promise<IccRankingsSnapshot> {
  const urlByKey = new Map<string, string>();

  async function imageFor(player: RankedPlayer): Promise<RankedPlayer> {
    if (hasUsableImage(player)) return player;

    const cacheKey = player.iccPlayerId ?? player.name;
    let url = urlByKey.get(cacheKey);
    if (!url) {
      url = await resolvePlayerImageUrl(player);
      urlByKey.set(cacheKey, url);
      if (!player.iccPlayerId) await sleep(250);
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
