import { NextResponse } from "next/server";

import { standApiError } from "@/lib/stand/api-error";
import { isCommentTargetType } from "@/lib/stand/engagement-types";
import { createComment, deleteComment, listComments } from "@/lib/stand/comments";
import { requireMemberSession } from "@/lib/social/session";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get("targetType") ?? "";
    const targetId = Number(searchParams.get("targetId"));
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    if (!isCommentTargetType(targetType) || !Number.isFinite(targetId) || targetId <= 0) {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }

    const comments = await listComments(targetType, targetId, limit);
    return NextResponse.json({ comments });
  } catch (err) {
    return standApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { member } = await requireMemberSession();
    const body = (await request.json()) as {
      targetType?: string;
      targetId?: number;
      body?: string;
    };

    const targetType = body.targetType ?? "";
    const targetId = Number(body.targetId);

    if (!isCommentTargetType(targetType) || !Number.isFinite(targetId) || targetId <= 0) {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }

    const comment = await createComment(
      member,
      targetType,
      targetId,
      typeof body.body === "string" ? body.body : "",
    );

    return NextResponse.json({ comment });
  } catch (err) {
    return standApiError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const { member } = await requireMemberSession();
    const { searchParams } = new URL(request.url);
    const commentId = Number(searchParams.get("id"));

    if (!Number.isFinite(commentId) || commentId <= 0) {
      return NextResponse.json({ error: "Invalid comment id" }, { status: 400 });
    }

    await deleteComment(commentId, member.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return standApiError(err);
  }
}
