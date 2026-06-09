import { NextResponse } from "next/server";

import { resolveMatchChatState } from "@/lib/match-chat/match-state";
import { matchChatApiError } from "@/lib/match-chat/api-error";
import { createMatchChatMessage, getMatchChatSnapshot } from "@/lib/match-chat/service";
import { requireMemberSession } from "@/lib/social/session";

export const dynamic = "force-dynamic";

function liveHintFromRequest(searchParams: URLSearchParams): boolean {
  return searchParams.get("live") === "1" || searchParams.get("live") === "true";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId")?.trim();

    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    const state = await resolveMatchChatState(matchId, {
      liveHint: liveHintFromRequest(searchParams),
    });
    const snapshot = await getMatchChatSnapshot(matchId, state.title, state);
    return NextResponse.json(snapshot);
  } catch (err) {
    return matchChatApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { member } = await requireMemberSession();
    const body = (await request.json()) as {
      matchId?: string;
      message?: string;
      live?: boolean;
    };

    const matchId = body.matchId?.trim();
    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    const state = await resolveMatchChatState(matchId, {
      liveHint: body.live === true,
    });

    const message = await createMatchChatMessage(
      member,
      matchId,
      typeof body.message === "string" ? body.message : "",
      state,
    );

    return NextResponse.json({ message });
  } catch (err) {
    return matchChatApiError(err);
  }
}
