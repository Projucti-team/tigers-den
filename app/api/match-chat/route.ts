import { NextResponse } from "next/server";

import { matchChatApiError } from "@/lib/match-chat/api-error";
import { createMatchChatMessage, getMatchChatSnapshot } from "@/lib/match-chat/service";
import { requireMemberSession } from "@/lib/social/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId")?.trim() || undefined;
    const snapshot = await getMatchChatSnapshot(matchId);
    return NextResponse.json(snapshot);
  } catch (err) {
    return matchChatApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { member } = await requireMemberSession();
    const body = (await request.json()) as { matchId?: string; message?: string };

    const matchId = body.matchId?.trim();
    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    const message = await createMatchChatMessage(
      member,
      matchId,
      typeof body.message === "string" ? body.message : "",
    );

    return NextResponse.json({ message });
  } catch (err) {
    return matchChatApiError(err);
  }
}
