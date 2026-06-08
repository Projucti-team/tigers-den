import { NextResponse } from "next/server";

import { socialApiError } from "@/lib/social/api-error";
import { getFeedForMember, getPostsForUsername } from "@/lib/social/posts";
import { requireMemberSession } from "@/lib/social/session";
import { attachPostEngagement } from "@/lib/stand/engagement";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (username) {
      const rawPosts = await getPostsForUsername(username);
      const posts = await attachPostEngagement(rawPosts);
      return NextResponse.json({ posts });
    }

    const { member } = await requireMemberSession();
    const rawPosts = await getFeedForMember(member);
    const posts = await attachPostEngagement(rawPosts, member.id);
    return NextResponse.json({ posts });
  } catch (err) {
    return socialApiError(err);
  }
}
