import { NextResponse } from "next/server";

export function standApiError(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "UNKNOWN";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (message === "MEMBER_NOT_FOUND") {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (message === "NOT_FOUND") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (message === "FORBIDDEN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (message === "INVALID_REACTION" || message === "INVALID_TARGET") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (message === "EMPTY_COMMENT") {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  }
  if (message === "COMMENT_TOO_LONG") {
    return NextResponse.json({ error: "Comment is too long" }, { status: 400 });
  }

  console.error("[stand-api]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
