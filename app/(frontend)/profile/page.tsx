import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { JOIN_PAGE_PATH, profilePath } from "@/lib/site-content";
import { getMemberByEmail } from "@/lib/social/member-record";

export default async function ProfileIndexPage() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect(JOIN_PAGE_PATH);
  }

  const member = await getMemberByEmail(email);
  if (!member?.username) {
    redirect(JOIN_PAGE_PATH);
  }

  redirect(profilePath(member.username));
}
