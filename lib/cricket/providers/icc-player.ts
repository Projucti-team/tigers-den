/** Player headshots and profile URLs from icc-cricket.com (Sportz.io feed). */

const ICC_PLAYER_IMAGE_BASE =
  "https://images.icc-cricket.com/image/upload/t_player-headshot-portrait-lg-webp/prd/assets/players/generic/colored";

export function iccPlayerImageUrl(iccPlayerId: string | number): string {
  return `${ICC_PLAYER_IMAGE_BASE}/${iccPlayerId}.png`;
}

export function isIccPlayerImageUrl(url: string): boolean {
  return url.includes("images.icc-cricket.com") && url.includes("/players/generic/colored/");
}

export async function verifyPlayerImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "image/*" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Prefer ICC headshot when we have a player id from the rankings feed. */
export async function resolveIccPlayerImageUrl(
  iccPlayerId: string | undefined,
): Promise<string | null> {
  if (!iccPlayerId) return null;
  const url = iccPlayerImageUrl(iccPlayerId);
  return (await verifyPlayerImageUrl(url)) ? url : null;
}
