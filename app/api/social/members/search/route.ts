import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { socialApiError } from "@/lib/social/api-error";
import { searchMembers } from "@/lib/social/follows";
import { getMemberByEmail } from "@/lib/social/member-record";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";

    const session = await auth();
    let viewerId: number | undefined;
    if (session?.user?.email) {
      const viewer = await getMemberByEmail(session.user.email);
      viewerId = viewer?.id;
    }

    const members = await searchMembers(q, viewerId);
    return NextResponse.json({ members });
  } catch (err) {
    return socialApiError(err);
  }
}
