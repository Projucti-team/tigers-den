import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { ProfileApp } from "@/components/profile/ProfileApp";
import { getMemberByEmail, getMemberByUsername } from "@/lib/social/member-record";

type PageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const member = await getMemberByUsername(username);
  if (!member) return { title: "Profile — The Tigers' Den" };

  return {
    title: `${member.name} (@${member.username}) — The Tigers' Den`,
  };
}

export default async function MemberProfilePage({ params }: PageProps) {
  const { username } = await params;
  const member = await getMemberByUsername(username);
  if (!member) notFound();

  const session = await auth();
  let isOwnProfile = false;
  if (session?.user?.email) {
    const viewer = await getMemberByEmail(session.user.email);
    isOwnProfile = viewer?.id === member.id;
  }

  return (
    <div className="py-8 md:py-12">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <ProfileApp username={username} isOwnProfile={isOwnProfile} />
      </div>
    </div>
  );
}
