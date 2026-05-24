import { NextResponse } from "next/server";

import { MEMBER_COUNT_BASE } from "@/lib/members/constants";
import { getDisplayedMemberCount } from "@/lib/members/service";

export async function GET() {
  try {
    const count = await getDisplayedMemberCount();
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: MEMBER_COUNT_BASE });
  }
}
