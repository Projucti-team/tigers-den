import { extractCricinfoPlayerId, squadPlayerDisplayName } from "@/lib/cricket/squads/profile-urls";
import {
  isProfileUrlForPlayer,
  resolveCricinfoPlayerProfileUrl,
} from "@/lib/cricket/squads/profile-urls";
import type { SquadPlayer } from "@/lib/cricket/squads/types";
import { resolveIccPlayerImageUrl } from "@/lib/cricket/providers/icc-player";
import { resolveCricinfoPlayerImageUrl } from "@/lib/cricket/providers/cricinfo-player";
import type { RankedPlayer } from "@/lib/cricket/types";
import { COUNTRY_SEEDS } from "@/lib/cricket/players/countries-seed";
import { getPayloadClient } from "@/lib/payload";

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
  iccPlayerId?: number | null;
  cricinfoPlayerId?: number | null;
  country: number | CountryDoc;
};

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

  const doc = result.docs[0] as PlayerDoc | undefined;
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
  return (await isProfileUrlForPlayer(name, profileUrl)) ? profileUrl : null;
}

async function resolveMissingUrls(input: EnsurePlayerInput): Promise<{
  profileUrl: string | null;
  imageUrl: string | null;
  cricinfoPlayerId: number | null;
}> {
  let profileUrl = await validatedProfileUrl(input.name, input.profileUrl);
  let imageUrl = input.imageUrl ?? null;
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
    const iccId = toNumericId(input.iccPlayerId);
    if (iccId) {
      imageUrl = await resolveIccPlayerImageUrl(String(iccId));
    }
    if (!imageUrl) {
      imageUrl = await resolveCricinfoPlayerImageUrl(input.name);
    }
    if (imageUrl?.includes("ui-avatars.com")) imageUrl = null;
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
  const lookupKey = playerLookupKey(input.countrySlug, displayName);
  const existing = await findPlayerDoc(input.countrySlug, displayName);
  const existingProfileUrl = await validatedProfileUrl(displayName, existing?.doc.profileUrl);

  if (existingProfileUrl && existing?.doc.imageUrl) {
    return toIdentity({ ...existing.doc, profileUrl: existingProfileUrl }, input.countrySlug);
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

  const payload = await getPayloadClient();
  const data = {
    lookupKey,
    displayName,
    country: country.id,
    profileUrl: resolved.profileUrl,
    imageUrl: resolved.imageUrl,
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

export async function resolveSquadPlayer(
  countrySlug: string,
  player: SquadPlayer,
): Promise<SquadPlayer> {
  const displayName = squadPlayerDisplayName(player.name);
  const trustedInputUrl = await validatedProfileUrl(displayName, player.profileUrl);

  const identity = await ensurePlayer({
    countrySlug,
    name: player.name,
    profileUrl: trustedInputUrl,
    imageUrl: player.imageUrl,
  });

  return {
    name: player.name,
    profileUrl: identity.profileUrl,
    imageUrl: identity.imageUrl,
  };
}

export async function resolveSquadPlayers(
  countrySlug: string,
  players: SquadPlayer[],
): Promise<SquadPlayer[]> {
  const resolved: SquadPlayer[] = [];
  for (const player of players) {
    resolved.push(await resolveSquadPlayer(countrySlug, player));
  }
  return resolved;
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
    if (!profileUrl) continue;

    if (await validatedProfileUrl(displayName, profileUrl)) continue;

    await payload.update({
      collection: "players",
      id: doc.id,
      data: {
        profileUrl: null,
        cricinfoPlayerId: null,
        lastResolvedAt: null,
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
