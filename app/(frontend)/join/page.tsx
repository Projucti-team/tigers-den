import type { Metadata } from "next";

import { BecomeAMemberSection } from "@/components/home/BecomeAMemberSection";

export const metadata: Metadata = {
  title: "Become a Member — The Tigers' Den",
  description:
    "Join The Tigers' Den with Google. Priority tickets, member rewards, and Bangladesh cricket's loudest fan army.",
};

export default function JoinPage() {
  return <BecomeAMemberSection />;
}
