import { NextResponse } from "next/server";

import { socialApiError } from "@/lib/social/api-error";
import { createMemberPost } from "@/lib/social/posts";
import { requireMemberSession } from "@/lib/social/session";

export async function POST(request: Request) {
  try {
    const { member } = await requireMemberSession();
    const body = (await request.json()) as {
      body?: string;
      imageIds?: number[];
    };

    const post = await createMemberPost(
      member,
      typeof body.body === "string" ? body.body : "",
      Array.isArray(body.imageIds)
        ? body.imageIds.filter((id) => typeof id === "number")
        : [],
    );

    return NextResponse.json({ post });
  } catch (err) {
    return socialApiError(err);
  }
}
