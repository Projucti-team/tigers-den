import { NextResponse } from "next/server";

import { getPayloadClient } from "@/lib/payload";
import {
  readAllTourSyncStates,
  setTourSeriesOverride,
  setTourSquadStoryUrl,
} from "@/lib/cricket/services/tour-sync-state-db";
import { invalidateTourSeriesOverrideCache } from "@/lib/cricket/providers/espn-squads";

export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: request.headers });
  return user;
}

/** List every tracked tour with the ESPN series it last resolved to + any admin override. */
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized — sign in to Payload admin first." },
      { status: 401 },
    );
  }

  try {
    const states = await readAllTourSyncStates();
    const rows = states.map((s) => ({
      tour_id: s.tour_id,
      tour_slug: s.tour_slug,
      current_status: s.current_status,
      espn_cricinfo_series_id: s.espn_cricinfo_series_id ?? null,
      espn_league_id: s.espn_league_id ?? null,
      espn_series_override: s.espn_series_override ?? null,
      squad_story_url: s.squad_story_url ?? null,
      updated_at: s.updated_at,
    }));
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load tour series state" },
      { status: 500 },
    );
  }
}

/** Pin (or clear, with cricinfoSeriesId: null) which ESPN series a tour pulls data from. */
export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized — sign in to Payload admin first." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      tour_id?: string;
      cricinfoSeriesId?: number | null;
      squadStoryUrl?: string | null;
    };
    if (!body.tour_id) {
      return NextResponse.json({ error: "tour_id is required" }, { status: 400 });
    }

    const result: Record<string, unknown> = { ok: true, tour_id: body.tour_id };

    if ("cricinfoSeriesId" in body) {
      const value =
        body.cricinfoSeriesId === null || body.cricinfoSeriesId === undefined
          ? null
          : Number(body.cricinfoSeriesId);

      if (value !== null && (!Number.isFinite(value) || value <= 0)) {
        return NextResponse.json({ error: "cricinfoSeriesId must be a positive number" }, { status: 400 });
      }

      await setTourSeriesOverride(body.tour_id, value);
      result.espn_series_override = value;
    }

    if ("squadStoryUrl" in body) {
      const raw = body.squadStoryUrl;
      const value = raw === null || raw === undefined || raw.trim() === "" ? null : raw.trim();
      await setTourSquadStoryUrl(body.tour_id, value);
      result.squad_story_url = value;
    }

    invalidateTourSeriesOverrideCache(body.tour_id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save override" },
      { status: 500 },
    );
  }
}
