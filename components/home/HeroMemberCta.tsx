"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import { JOIN_PAGE_PATH } from "@/lib/site-content";

export function HeroMemberCta() {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  if (isLoggedIn) {
    return (
      <span
        className="cursor-default rounded bg-charcoal/35 px-8 py-4 text-sm font-extrabold uppercase tracking-wide text-white/45"
        aria-disabled
      >
        Become a Member
      </span>
    );
  }

  return (
    <Link href={JOIN_PAGE_PATH} className="fan-btn-green rounded px-8 py-4 text-sm">
      Become a Member
    </Link>
  );
}
