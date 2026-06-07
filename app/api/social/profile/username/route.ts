import { NextResponse } from "next/server";

import { socialApiError } from "@/lib/social/api-error";
import { updateMemberUsername } from "@/lib/social/member-record";
import { requireMemberSession } from "@/lib/social/session";

export async function PATCH(request: Request) {
  try {
    const { member } = await requireMemberSession();
    const body = (await request.json()) as { username?: string };

    if (typeof body.username !== "string" || !body.username.trim()) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const updated = await updateMemberUsername(member.id, body.username.trim());

    return NextResponse.json({ username: String(updated.username) });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "INVALID_USERNAME") {
        return NextResponse.json(
          {
            error:
              "Use 3–32 characters: lowercase letters, numbers, and hyphens (not at the start or end).",
          },
          { status: 400 },
        );
      }
      if (err.message === "USERNAME_TAKEN") {
        return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
      }
    }
    return socialApiError(err);
  }
}
