import { NextResponse } from "next/server";

import { socialApiError } from "@/lib/social/api-error";
import { getTimelinePosts } from "@/lib/social/posts";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const posts = await getTimelinePosts(limit);
    return NextResponse.json({ posts });
  } catch (err) {
    return socialApiError(err);
  }
}
