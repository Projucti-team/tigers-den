import { NextResponse } from "next/server";

import { matchChatApiError } from "@/lib/match-chat/api-error";
import { createMatchChatMessage, getMatchChatSnapshot } from "@/lib/match-chat/service";
import { requireMemberSession } from "@/lib/social/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getMatchChatSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    return matchChatApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { member } = await requireMemberSession();
    const body = (await request.json()) as { message?: string };

    const message = await createMatchChatMessage(
      member,
      typeof body.message === "string" ? body.message : "",
    );

    return NextResponse.json({ message });
  } catch (err) {
    return matchChatApiError(err);
  }
}
