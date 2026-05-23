import { withCache } from "@/lib/cricket/cache";
import { CRICAPI_BASE, FORMATS_BY_GENDER } from "@/lib/cricket/constants";
import { isCricApiConfigured } from "@/lib/cricket/providers/cricapi";
import type { IccRankingsSnapshot } from "@/lib/cricket/providers/icc-sportz";
import type { RankedPlayer } from "@/lib/cricket/types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey(): string | null {
  return process.env.CRICKET_DATA_API_KEY || null;
}

function isPlaceholderPhoto(url: string): boolean {
  return url.includes("ui-avatars.com") || url.includes("/icon512.");
}

function avatarFallback(name: string): string {
  const encoded = encodeURIComponent(name.replace(/\s+/g, "+"));
  return `https://ui-avatars.com/api/?name=${encoded}&background=006a4e&color=fff&size=320&bold=true`;
}

async function cricFetchRaw(path: string, params: Record<string, string>) {
  const key = getApiKey();
  if (!key) return null;

  const url = new URL(`${CRICAPI_BASE}/${path}`);
  url.searchParams.set("apikey", key);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  return res.json() as Promise<{ status?: string; data?: unknown }>;
}

/** Resolve ICC player name → photo URL via CricAPI */
export async function resolvePlayerImageUrl(playerName: string): Promise<string> {
  return withCache(`player-img:${playerName}`, 24 * 60 * 60 * 1000, async () => {
    if (!isCricApiConfigured()) {
      return avatarFallback(playerName);
    }

    try {
      let finder = await cricFetchRaw("players", { search: playerName });
      if (finder?.status !== "success") {
        finder = await cricFetchRaw("player_info", { search: playerName });
      }
      const players = (finder?.data as { id?: string; name?: string; pid?: string }[]) || [];
      const match =
        players.find((p) => p.name?.toLowerCase() === playerName.toLowerCase()) ||
        players[0];

      const playerId = match?.id || match?.pid;
      if (!playerId) {
        return avatarFallback(playerName);
      }

      const info = await cricFetchRaw("players_info", { id: String(playerId) });
      const profile = info?.data as { image?: string; playerImg?: string } | undefined;
      const url = profile?.image || profile?.playerImg;

      if (url && typeof url === "string") {
        return url.startsWith("http") ? url : `https://www.cricapi.com${url}`;
      }
    } catch {
      /* use fallback */
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

/** Bake photo URLs into data/icc-rankings.json (run via scrape — works on Vercel without live API). */
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
      await sleep(250);
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
