import { NextResponse } from "next/server";

export function matchChatApiError(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "UNKNOWN";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (message === "MEMBER_NOT_FOUND") {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (message === "CHAT_CLOSED") {
    return NextResponse.json({ error: "Chat is closed for this match" }, { status: 403 });
  }
  if (message === "EMPTY_MESSAGE") {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  }
  if (message === "MESSAGE_TOO_LONG") {
    return NextResponse.json({ error: "Message is too long" }, { status: 400 });
  }

  console.error("[match-chat-api]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
