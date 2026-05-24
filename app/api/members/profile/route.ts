import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getMemberByEmail, updateMemberProfile } from "@/lib/members/service";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getMemberByEmail(email);
  if (!profile) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { country?: string; favoritePlayer?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const profile = await updateMemberProfile(email, {
    country: typeof body.country === "string" ? body.country : undefined,
    favoritePlayer:
      typeof body.favoritePlayer === "string" ? body.favoritePlayer : undefined,
  });

  if (!profile) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}
