import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getMemberByEmail } from "@/lib/social/member-record";
import { standApiError } from "@/lib/stand/api-error";
import {
  isReactionId,
  isReactionTargetType,
} from "@/lib/stand/engagement-types";
import { getReactionSummary, setReaction } from "@/lib/stand/reactions";
import { requireMemberSession } from "@/lib/social/session";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get("targetType") ?? "";
    const targetId = Number(searchParams.get("targetId"));

    if (!isReactionTargetType(targetType) || !Number.isFinite(targetId) || targetId <= 0) {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }

    let viewerId: number | undefined;
    const session = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    if (email) {
      const member = await getMemberByEmail(email);
      viewerId = member?.id;
    }

    const summary = await getReactionSummary(targetType, targetId, viewerId);
    return NextResponse.json({ reactions: summary });
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
      reaction?: string;
    };

    const targetType = body.targetType ?? "";
    const targetId = Number(body.targetId);
    const reaction = body.reaction ?? "";

    if (!isReactionTargetType(targetType) || !Number.isFinite(targetId) || targetId <= 0) {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }
    if (!isReactionId(reaction)) {
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
    }

    const summary = await setReaction(member, targetType, targetId, reaction);
    return NextResponse.json({ reactions: summary });
  } catch (err) {
    return standApiError(err);
  }
}
