import { NextResponse } from "next/server";

import { resolveMatchChatState } from "@/lib/match-chat/match-state";
import { matchChatApiError } from "@/lib/match-chat/api-error";
import { createMatchChatMessage, getMatchChatSnapshot } from "@/lib/match-chat/service";
import { requireMemberSession } from "@/lib/social/session";

export const dynamic = "force-dynamic";

function flag(value: string | null): boolean {
  return value === "1" || value === "true";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId")?.trim();

    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    const title = searchParams.get("title")?.trim() || undefined;
    const state = await resolveMatchChatState(matchId, {
      liveHint: flag(searchParams.get("live")),
      completedHint: flag(searchParams.get("completed")),
      title,
    });
    const snapshot = await getMatchChatSnapshot(matchId, state.title ?? title, state);
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
      completed?: boolean;
      title?: string;
    };

    const matchId = body.matchId?.trim();
    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    const state = await resolveMatchChatState(matchId, {
      liveHint: body.live === true,
      completedHint: body.completed === true,
      title: typeof body.title === "string" ? body.title.trim() : undefined,
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
