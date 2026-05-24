import { auth } from "@/auth";
import { getMemberByEmail } from "@/lib/social/member-record";
import type { Member } from "@/payload-types";

export async function requireMemberSession(): Promise<{ email: string; member: Member }> {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email) {
    throw new Error("UNAUTHORIZED");
  }

  const member = await getMemberByEmail(email);
  if (!member) {
    throw new Error("MEMBER_NOT_FOUND");
  }

  return { email, member };
}
