import { NextResponse } from "next/server";

import { socialApiError } from "@/lib/social/api-error";
import { deleteMemberPost, updateMemberPost } from "@/lib/social/posts";
import { requireMemberSession } from "@/lib/social/session";

type RouteContext = { params: Promise<{ id: string }> };

function parsePostId(raw: string): number {
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error("POST_NOT_FOUND");
  }
  return id;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { member } = await requireMemberSession();
    const { id: idParam } = await context.params;
    const postId = parsePostId(idParam);

    const body = (await request.json()) as { body?: string };
    if (typeof body.body !== "string") {
      return NextResponse.json({ error: "Post body required" }, { status: 400 });
    }

    const post = await updateMemberPost(postId, member, body.body);
    return NextResponse.json({ post });
  } catch (err) {
    return socialApiError(err);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { member } = await requireMemberSession();
    const { id: idParam } = await context.params;
    const postId = parsePostId(idParam);

    await deleteMemberPost(postId, member);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return socialApiError(err);
  }
}
