import { NextResponse } from "next/server";

import { socialApiError } from "@/lib/social/api-error";
import { followMember, unfollowMember } from "@/lib/social/follows";
import { requireMemberSession } from "@/lib/social/session";

export async function POST(request: Request) {
  try {
    const { member } = await requireMemberSession();
    const { username } = (await request.json()) as { username?: string };
    if (!username?.trim()) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    await followMember(member, username.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return socialApiError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const { member } = await requireMemberSession();
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    if (!username?.trim()) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    await unfollowMember(member, username.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return socialApiError(err);
  }
}
