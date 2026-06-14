import { NextResponse } from "next/server";

export function socialApiError(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "UNKNOWN";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (message === "MEMBER_NOT_FOUND") {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (message === "USER_NOT_FOUND") {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (message === "EMPTY_POST") {
    return NextResponse.json({ error: "Post cannot be empty" }, { status: 400 });
  }
  if (message === "POST_NOT_FOUND") {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (message === "FORBIDDEN") {
    return NextResponse.json({ error: "You can only edit or delete your own posts" }, { status: 403 });
  }

  console.error("[social-api]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
