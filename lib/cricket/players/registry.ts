import {
  extractCricinfoPlayerId,
  fetchAthleteHeadshotUrl,
  squadPlayerDisplayName,
} from "@/lib/cricket/squads/profile-urls";
import {
  isProfileUrlForPlayer,
  resolveCricinfoPlayerProfileUrl,
} from "@/lib/cricket/squads/profile-urls";
import type { SquadPlayer } from "@/lib/cricket/squads/types";
import { resolveIccPlayerImageUrl, verifyPlayerImageUrlCached } from "@/lib/cricket/providers/icc-player";
import { resolveCricinfoPlayerImageUrl } from "@/lib/cricket/providers/cricinfo-player";
import type { RankedPlayer } from "@/lib/cricket/types";
import { COUNTRY_SEEDS } from "@/lib/cricket/players/countries-seed";
import { getPayloadClient } from "@/lib/payload";
import { lookupSeedPlayerProfileUrl } from "@/lib/cricket/squads/store";
import { mirrorPlayerImage, resolvePhotoUrl } from "@/lib/cricket/players/mirror-image";

export type PlayerIdentity = {
  id: number;
  displayName: string;
  profileUrl: string | null;
  imageUrl: string | null;
  iccPlayerId: number | null;
  cricinfoPlayerId: number | null;
  countrySlug: string;
};

type CountryDoc = {
  id: number;
  slug: string;
};

type PlayerDoc = {
  id: number;
  lookupKey: string;
  displayName: string;
  profileUrl?: string | null;
  imageUrl?: string | null;
  photo?: number | { id: number } | null;
  iccPlayerId?: number | null;
  cricinfoPlayerId?: number | null;
  country: number | CountryDoc;
};

function photoIdOf(doc: Pick<PlayerDoc, "photo"> | undefined): number | null {
  const photo = doc?.photo;
  if (photo == null) return null;
  return typeof photo === "object" ? toNumericId(photo.id) : toNumericId(photo);
}

function toNumericId(id: string | number | null | undefined): number | null {
  if (id == null) return null;
  const value = typeof id === "number" ? id : Number(id);
  return Number.isFinite(value) ? value : null;
}

let countriesReady: Promise<Map<string, CountryDoc>> | null = null;

function normalizePlayerName(name: string): string {
  return squadPlayerDisplayName(name)
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function playerLookupKey(countrySlug: string, name: string): string {
  return `${countrySlug}:${normalizePlayerName(name)}`;
}

function toIdentity(doc: PlayerDoc, countrySlug: string): PlayerIdentity {
  return {
    id: doc.id,
    displayName: doc.displayName,
    profileUrl: doc.profileUrl ?? null,
    imageUrl: doc.imageUrl ?? null,
    iccPlayerId: doc.iccPlayerId ?? null,
    cricinfoPlayerId: doc.cricinfoPlayerId ?? null,
    countrySlug,
  };
}

function countrySlugFromDoc(country: number | CountryDoc, byId: Map<number, CountryDoc>): string {
  if (typeof country === "object" && country?.slug) return country.slug;
  return byId.get(country as number)?.slug ?? "unknown";
}

/** Upsert seed countries — safe to call on every sync. */
export async function ensureCountriesSeeded(): Promise<Map<string, CountryDoc>> {
  if (countriesReady) return countriesReady;

  countriesReady = (async () => {
    const payload = await getPayloadClient();
    const bySlug = new Map<string, CountryDoc>();

    for (const seed of COUNTRY_SEEDS) {
      const existing = await payload.find({
        collection: "countries",
        where: { slug: { equals: seed.slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });

      const doc = existing.docs[0]
        ? await payload.update({
            collection: "countries",
            id: existing.docs[0].id,
            data: {
              name: seed.name,
              shortName: seed.shortName,
              espnTeamId: seed.espnTeamId,
              iccTeamName: seed.iccTeamName,
            },
            overrideAccess: true,
          })
        : await payload.create({
            collection: "countries",
            data: seed,
            overrideAccess: true,
          });

      bySlug.set(seed.slug, { id: doc.id as number, slug: seed.slug });
    }

    return bySlug;
  })().catch((err) => {
    countriesReady = null;
    throw err;
  });

  return countriesReady;
}

type AliasedPlayerDoc = PlayerDoc & { aliases?: { name: string }[] | null };

/**
 * A source spelling a name differently ("Mohammad Naeem" vs "Mohammed Naeem") would otherwise
 * derive a different lookupKey and quietly create a duplicate player on every sync. Checked
 * only on a direct lookupKey miss, so the common case stays a single indexed query.
 */
async function findPlayerByAlias(
  countrySlug: string,
  name: string,
): Promise<PlayerDoc | null> {
  const countries = await ensureCountriesSeeded();
  const country = countries.get(countrySlug);
  if (!country) return null;

  const payload = await getPayloadClient();
  const target = normalizePlayerName(name);

  const result = await payload.find({
    collection: "players",
    where: { country: { equals: country.id } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });

  for (const doc of result.docs as AliasedPlayerDoc[]) {
    const hit = (doc.aliases ?? []).some((a) => normalizePlayerName(a.name) === target);
    if (hit) return doc;
  }

  return null;
}

async function findPlayerDoc(
  countrySlug: string,
  name: string,
): Promise<{ doc: PlayerDoc; countrySlug: string } | null> {
  const payload = await getPayloadClient();
  const lookupKey = playerLookupKey(countrySlug, name);

  const result = await payload.find({
    collection: "players",
    where: { lookupKey: { equals: lookupKey } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });

  const doc = (result.docs[0] as PlayerDoc | undefined) ?? (await findPlayerByAlias(countrySlug, name)) ?? undefined;
  if (!doc) return null;

  const countries = await ensureCountriesSeeded();
  const slug = countrySlugFromDoc(doc.country, new Map([...countries.values()].map((c) => [c.id, c])));
  return { doc, countrySlug: slug };
}

export async function lookupPlayer(
  countrySlug: string,
  name: string,
): Promise<PlayerIdentity | null> {
  const found = await findPlayerDoc(countrySlug, name);
  if (!found) return null;
  return toIdentity(found.doc, found.countrySlug);
}

type EnsurePlayerInput = {
  countrySlug: string;
  name: string;
  profileUrl?: string | null;
  imageUrl?: string | null;
  iccPlayerId?: number | null;
  cricinfoPlayerId?: number | null;
};

async function validatedProfileUrl(
  name: string,
  profileUrl: string | null | undefined,
): Promise<string | null> {
  if (!profileUrl) return null;
  const id = extractCricinfoPlayerId(profileUrl);
  if (!id) return null;
  return (await isProfileUrlForPlayer(name, profileUrl)) ? profileUrl : null;
}

function profileUrlWithId(profileUrl: string | null | undefined): string | null {
  if (!profileUrl) return null;
  return extractCricinfoPlayerId(profileUrl) ? profileUrl : null;
}

async function isUsableCachedImageUrl(url: string): Promise<boolean> {
  if (url.includes("ui-avatars.com")) return false;
  if (url.includes("a.espncdn.com/i/headshots/cricket")) {
    return verifyPlayerImageUrlCached(url);
  }
  return true;
}

async function validatedImageUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  return (await isUsableCachedImageUrl(url)) ? url : null;
}

async function resolvePlayerImageUrl(
  name: string,
  profileUrl: string | null,
  cricinfoPlayerId: number | null,
  iccPlayerId: number | null,
  existingImageUrl: string | null | undefined,
): Promise<string | null> {
  if (existingImageUrl && (await isUsableCachedImageUrl(existingImageUrl))) {
    return existingImageUrl;
  }

  const iccId = toNumericId(iccPlayerId);
  if (iccId) {
    const iccImage = await resolveIccPlayerImageUrl(String(iccId));
    if (iccImage) return iccImage;
  }

  const id = cricinfoPlayerId ?? (profileUrl ? extractCricinfoPlayerId(profileUrl) : null);
  if (id) {
    return fetchAthleteHeadshotUrl(id);
  }

  const fromSearch = await resolveCricinfoPlayerImageUrl(name);
  if (fromSearch?.includes("ui-avatars.com")) return null;
  return fromSearch;
}

async function resolveMissingUrls(input: EnsurePlayerInput): Promise<{
  profileUrl: string | null;
  imageUrl: string | null;
  cricinfoPlayerId: number | null;
}> {
  let profileUrl = await validatedProfileUrl(input.name, input.profileUrl);
  let imageUrl = await validatedImageUrl(input.imageUrl);
  let cricinfoPlayerId = input.cricinfoPlayerId ?? null;

  if (profileUrl && !cricinfoPlayerId) {
    cricinfoPlayerId = extractCricinfoPlayerId(profileUrl);
  }

  if (!profileUrl) {
    profileUrl = await resolveCricinfoPlayerProfileUrl(input.name, input.countrySlug);
    if (profileUrl && !cricinfoPlayerId) {
      cricinfoPlayerId = extractCricinfoPlayerId(profileUrl);
    }
  }

  if (!imageUrl) {
    imageUrl = await resolvePlayerImageUrl(
      input.name,
      profileUrl,
      cricinfoPlayerId,
      input.iccPlayerId ?? null,
      input.imageUrl,
    );
  }

  return { profileUrl, imageUrl, cricinfoPlayerId };
}

/** Find or create a player row; only hits external APIs when URLs are missing. */
export async function ensurePlayer(input: EnsurePlayerInput): Promise<PlayerIdentity> {
  const countries = await ensureCountriesSeeded();
  const country = countries.get(input.countrySlug);
  if (!country) {
    throw new Error(`Unknown country slug: ${input.countrySlug}`);
  }

  const displayName = squadPlayerDisplayName(input.name);
  const existing = await findPlayerDoc(input.countrySlug, displayName);
  // When `existing` was matched via an alias (a different spelling than its canonical
  // lookupKey/displayName), keep the canonical identity as-is -- recomputing these from
  // whatever spelling this particular call happens to use would flip-flop the record's
  // identity depending on which source synced most recently.
  const lookupKey = existing?.doc.lookupKey ?? playerLookupKey(input.countrySlug, displayName);
  const canonicalDisplayName = existing?.doc.displayName ?? displayName;
  const existingProfileUrl = await validatedProfileUrl(displayName, existing?.doc.profileUrl);
  const existingPhotoId = photoIdOf(existing?.doc);

  // Only take the fast path once we've actually mirrored (or an admin has manually uploaded)
  // a local photo -- otherwise every player created before that field existed would keep
  // hot-linking their source imageUrl forever, since it already passes isUsableCachedImageUrl.
  if (existingProfileUrl && existing?.doc.imageUrl && existingPhotoId) {
    const cachedImage = existing.doc.imageUrl;
    if (await isUsableCachedImageUrl(cachedImage)) {
      return toIdentity({ ...existing.doc, profileUrl: existingProfileUrl }, input.countrySlug);
    }
  }

  const resolved = await resolveMissingUrls({
    ...input,
    name: displayName,
    profileUrl:
      (await validatedProfileUrl(displayName, input.profileUrl)) ??
      existingProfileUrl ??
      null,
    imageUrl: input.imageUrl ?? existing?.doc.imageUrl,
    iccPlayerId: input.iccPlayerId ?? existing?.doc.iccPlayerId,
    cricinfoPlayerId: input.cricinfoPlayerId ?? existing?.doc.cricinfoPlayerId,
  });

  // Mirror the resolved headshot into our own Media collection so the site never hot-links
  // ICC/Cricinfo/CricAPI CDNs. Sticky once set: a photo (auto-mirrored or manually uploaded
  // by an admin) is never silently replaced -- clear it in the admin panel to force a re-mirror.
  let photoId = existingPhotoId;
  let displayImageUrl = resolved.imageUrl;
  if (!photoId && resolved.imageUrl) {
    const mirrored = await mirrorPlayerImage(resolved.imageUrl, canonicalDisplayName);
    if (mirrored) {
      photoId = mirrored.mediaId;
      displayImageUrl = mirrored.url ?? resolved.imageUrl;
    }
  } else if (photoId) {
    displayImageUrl = (await resolvePhotoUrl(photoId)) ?? resolved.imageUrl;
  }

  const payload = await getPayloadClient();
  const data = {
    lookupKey,
    displayName: canonicalDisplayName,
    country: country.id,
    profileUrl: resolved.profileUrl,
    imageUrl: displayImageUrl,
    photo: photoId,
    iccPlayerId: toNumericId(input.iccPlayerId ?? existing?.doc.iccPlayerId),
    cricinfoPlayerId: resolved.cricinfoPlayerId ?? existing?.doc.cricinfoPlayerId ?? null,
    lastResolvedAt: new Date().toISOString(),
  };

  const doc = existing
    ? await payload.update({
        collection: "players",
        id: existing.doc.id,
        data,
        overrideAccess: true,
      })
    : await payload.create({
        collection: "players",
        data,
        overrideAccess: true,
      });

  return toIdentity(doc as PlayerDoc, input.countrySlug);
}

export async function enrichSquadPlayerForDisplay(
  countrySlug: string,
  player: SquadPlayer,
): Promise<SquadPlayer> {
  const displayName = squadPlayerDisplayName(player.name);
  const cached = await lookupPlayer(countrySlug, player.name);

  let profileUrl =
    profileUrlWithId(player.profileUrl) ??
    profileUrlWithId(cached?.profileUrl) ??
    profileUrlWithId(await lookupSeedPlayerProfileUrl(displayName));

  if (!profileUrl) {
    profileUrl = await resolveCricinfoPlayerProfileUrl(displayName, countrySlug);
  }

  const playerId = profileUrl ? extractCricinfoPlayerId(profileUrl) : null;
  let imageUrl = await validatedImageUrl(cached?.imageUrl);
  if (!imageUrl && playerId) {
    imageUrl = await fetchAthleteHeadshotUrl(playerId);
  }

  return {
    name: player.name,
    profileUrl,
    imageUrl,
    isCaptain: player.isCaptain,
    isWicketKeeper: player.isWicketKeeper,
  };
}

export async function enrichSquadPlayersForDisplay(
  countrySlug: string,
  players: SquadPlayer[],
): Promise<SquadPlayer[]> {
  return Promise.all(players.map((player) => enrichSquadPlayerForDisplay(countrySlug, player)));
}

export async function resolveSquadPlayer(
  countrySlug: string,
  player: SquadPlayer,
): Promise<SquadPlayer> {
  const identity = await ensurePlayer({
    countrySlug,
    name: player.name,
    profileUrl: player.profileUrl,
    imageUrl: player.imageUrl,
  });

  return {
    name: player.name,
    profileUrl: identity.profileUrl,
    imageUrl: identity.imageUrl,
    isCaptain: player.isCaptain,
    isWicketKeeper: player.isWicketKeeper,
  };
}

export async function resolveSquadPlayers(
  countrySlug: string,
  players: SquadPlayer[],
): Promise<SquadPlayer[]> {
  return Promise.all(players.map((player) => resolveSquadPlayer(countrySlug, player)));
}

export async function repairInvalidPlayerProfiles(): Promise<number> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "players",
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });

  let repaired = 0;
  for (const doc of result.docs) {
    const profileUrl = doc.profileUrl as string | null | undefined;
    const displayName = doc.displayName as string;
    const imageUrl = doc.imageUrl as string | null | undefined;
    const profileInvalid = profileUrl && !(await validatedProfileUrl(displayName, profileUrl));
    const imageInvalid = imageUrl && !(await isUsableCachedImageUrl(imageUrl));

    if (!profileInvalid && !imageInvalid) continue;

    await payload.update({
      collection: "players",
      id: doc.id,
      data: {
        ...(profileInvalid
          ? { profileUrl: null, cricinfoPlayerId: null, lastResolvedAt: null }
          : {}),
        ...(imageInvalid ? { imageUrl: null } : {}),
      },
      overrideAccess: true,
    });
    repaired += 1;
  }

  return repaired;
}

export async function resolveRankedPlayer(player: RankedPlayer): Promise<RankedPlayer> {
  const { iccTeamNameToCountrySlug } = await import("@/lib/cricket/players/countries-seed");
  const countrySlug = iccTeamNameToCountrySlug(player.team ?? "") ?? "bangladesh";

  const identity = await ensurePlayer({
    countrySlug,
    name: player.name,
    profileUrl: player.profileUrl,
    imageUrl: player.imageUrl,
    iccPlayerId: toNumericId(player.iccPlayerId),
  });

  return {
    ...player,
    profileUrl: identity.profileUrl ?? player.profileUrl,
    imageUrl: identity.imageUrl ?? player.imageUrl,
  };
}
