import { NextResponse } from "next/server";

import { socialApiError } from "@/lib/social/api-error";
import { enrichMemberSearch } from "@/lib/social/follows";
import { requireMemberSession } from "@/lib/social/session";
import { toPublicMember } from "@/lib/social/member-record";

export async function GET() {
  try {
    const { member } = await requireMemberSession();
    const profile = await enrichMemberSearch(member, member.id);
    return NextResponse.json({
      member: toPublicMember(member, { includeEmail: true }),
      profile,
    });
  } catch (err) {
    return socialApiError(err);
  }
}
