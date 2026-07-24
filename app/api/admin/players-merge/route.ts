import { NextResponse } from "next/server";

import { getPayloadClient } from "@/lib/payload";
import { playerNamesMatch } from "@/lib/cricket/squads/profile-urls";

export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: request.headers });
  return user;
}

type PlayerRow = {
  id: number;
  displayName: string;
  country: number | { id: number; name?: string; slug?: string };
  profileUrl?: string | null;
  imageUrl?: string | null;
  photo?: number | { id: number } | null;
  cricinfoPlayerId?: number | null;
  iccPlayerId?: number | null;
  aliases?: { name: string }[] | null;
};

type PlayerSummary = {
  id: number;
  displayName: string;
  countryName: string;
  profileUrl: string | null;
  hasPhoto: boolean;
  cricinfoPlayerId: number | null;
  iccPlayerId: number | null;
};

function countryLabel(country: PlayerRow["country"]): { id: number; name: string } {
  if (typeof country === "object" && country) {
    return { id: country.id, name: country.name ?? country.slug ?? String(country.id) };
  }
  return { id: country, name: String(country) };
}

function toSummary(row: PlayerRow, countryName: string): PlayerSummary {
  return {
    id: row.id,
    displayName: row.displayName,
    countryName,
    profileUrl: row.profileUrl ?? null,
    hasPhoto: Boolean(row.photo),
    cricinfoPlayerId: row.cricinfoPlayerId ?? null,
    iccPlayerId: row.iccPlayerId ?? null,
  };
}

/**
 * Group players within the same country whose names are the same person under different
 * spellings, reusing the same fuzzy matcher the sync pipeline uses to match a squad-list name
 * against an ESPN athlete name (lib/cricket/squads/profile-urls.ts). O(n^2) per country, but
 * squad rosters are small enough (a few hundred players per country at most) for that to be
 * instant -- this only runs when an admin opens the panel, never during sync.
 */
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized — sign in to Payload admin first." },
      { status: 401 },
    );
  }

  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "players",
      limit: 2000,
      depth: 1,
      overrideAccess: true,
    });

    const rows = result.docs as unknown as PlayerRow[];
    const byCountry = new Map<number, { name: string; rows: PlayerRow[] }>();
    for (const row of rows) {
      const { id, name } = countryLabel(row.country);
      const bucket = byCountry.get(id) ?? { name, rows: [] };
      bucket.rows.push(row);
      byCountry.set(id, bucket);
    }

    const groups: { countryName: string; players: PlayerSummary[] }[] = [];

    for (const { name: countryName, rows: countryRows } of byCountry.values()) {
      const used = new Set<number>();
      for (let i = 0; i < countryRows.length; i++) {
        const a = countryRows[i];
        if (used.has(a.id)) continue;

        const cluster: PlayerRow[] = [a];
        for (let j = i + 1; j < countryRows.length; j++) {
          const b = countryRows[j];
          if (used.has(b.id)) continue;
          if (playerNamesMatch(a.displayName, b.displayName)) {
            cluster.push(b);
          }
        }

        if (cluster.length > 1) {
          for (const p of cluster) used.add(p.id);
          groups.push({
            countryName,
            players: cluster.map((p) => toSummary(p, countryName)),
          });
        }
      }
    }

    return NextResponse.json({ groups });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load duplicate candidates" },
      { status: 500 },
    );
  }
}

/**
 * Merge one or more duplicate player records into a single canonical one. The merged
 * records' names become aliases on the survivor (so future syncs seeing that spelling resolve
 * to the same player instead of recreating a duplicate), any profile/image/id fields the
 * survivor is missing get filled in from the merged records, and the merged records are
 * deleted. This only touches the Players identity cache -- already-cached tour squad
 * snapshots pick up the merged identity on their next scheduled sync.
 */
export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized — sign in to Payload admin first." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as { keepId?: number; mergeIds?: number[] };
    const keepId = Number(body.keepId);
    const mergeIds = (body.mergeIds ?? []).map(Number).filter((id) => Number.isFinite(id) && id !== keepId);

    if (!Number.isFinite(keepId) || mergeIds.length === 0) {
      return NextResponse.json(
        { error: "keepId and at least one distinct mergeIds entry are required" },
        { status: 400 },
      );
    }

    const payload = await getPayloadClient();
    const keep = (await payload.findByID({
      collection: "players",
      id: keepId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as PlayerRow;

    if (!keep) {
      return NextResponse.json({ error: `Player ${keepId} not found` }, { status: 404 });
    }

    const aliasNames = new Set(
      (keep.aliases ?? []).map((a) => a.name.trim().toLowerCase()).filter(Boolean),
    );
    const patch: Record<string, unknown> = {};

    for (const mergeId of mergeIds) {
      const merged = (await payload.findByID({
        collection: "players",
        id: mergeId,
        depth: 0,
        overrideAccess: true,
      }).catch(() => null)) as unknown as PlayerRow | null;
      if (!merged) continue;

      if (merged.displayName && merged.displayName.trim().toLowerCase() !== keep.displayName.trim().toLowerCase()) {
        aliasNames.add(merged.displayName.trim().toLowerCase());
      }
      for (const alias of merged.aliases ?? []) {
        if (alias.name) aliasNames.add(alias.name.trim().toLowerCase());
      }

      if (!keep.profileUrl && merged.profileUrl) patch.profileUrl = merged.profileUrl;
      if (!keep.cricinfoPlayerId && merged.cricinfoPlayerId) patch.cricinfoPlayerId = merged.cricinfoPlayerId;
      if (!keep.iccPlayerId && merged.iccPlayerId) patch.iccPlayerId = merged.iccPlayerId;
      if (!keep.photo && merged.photo) patch.photo = typeof merged.photo === "object" ? merged.photo.id : merged.photo;
      if (!keep.imageUrl && merged.imageUrl) patch.imageUrl = merged.imageUrl;

      await payload.delete({ collection: "players", id: mergeId, overrideAccess: true });
    }

    patch.aliases = [...aliasNames].map((name) => ({ name }));

    const updated = await payload.update({
      collection: "players",
      id: keepId,
      data: patch,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true, player: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Merge failed" },
      { status: 500 },
    );
  }
}
