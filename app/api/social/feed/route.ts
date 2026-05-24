import { NextResponse } from "next/server";

import { socialApiError } from "@/lib/social/api-error";
import { getFeedForMember, getPostsForUsername } from "@/lib/social/posts";
import { requireMemberSession } from "@/lib/social/session";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (username) {
      const posts = await getPostsForUsername(username);
      return NextResponse.json({ posts });
    }

    const { member } = await requireMemberSession();
    const posts = await getFeedForMember(member);
    return NextResponse.json({ posts });
  } catch (err) {
    return socialApiError(err);
  }
}
