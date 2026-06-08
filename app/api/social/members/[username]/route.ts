import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { socialApiError } from "@/lib/social/api-error";
import { enrichMemberSearch } from "@/lib/social/follows";
import { getMemberByEmail, getMemberByUsername } from "@/lib/social/member-record";
import { getPostsForUsername } from "@/lib/social/posts";
import { attachPostEngagement } from "@/lib/stand/engagement";

type RouteContext = { params: Promise<{ username: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { username } = await context.params;
    const member = await getMemberByUsername(username);
    if (!member) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const session = await auth();
    let viewerId: number | undefined;
    if (session?.user?.email) {
      const viewer = await getMemberByEmail(session.user.email);
      viewerId = viewer?.id;
    }

    const [profile, rawPosts] = await Promise.all([
      enrichMemberSearch(member, viewerId),
      getPostsForUsername(username),
    ]);
    const posts = await attachPostEngagement(rawPosts, viewerId);

    return NextResponse.json({ profile, posts });
  } catch (err) {
    return socialApiError(err);
  }
}
