"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import { MemberAccountMenu } from "@/components/layout/MemberAccountMenu";
import { JOIN_PAGE_PATH } from "@/lib/site-content";

export function TopBar() {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  return (
    <div className="fan-gradient-bar animate-shimmer-bar border-b-2 border-amber/80 text-white">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs md:px-8">
        <p className="font-display font-bold uppercase tracking-wide drop-shadow-sm">
          We are The Tigers&apos; Den
        </p>
        <div className="flex flex-wrap items-center gap-3 md:gap-5">
          {isLoggedIn ? (
            <span className="cursor-default font-semibold text-white/40">Register</span>
          ) : (
            <Link href={JOIN_PAGE_PATH} className="font-semibold hover:text-amber">
              Register
            </Link>
          )}
          <span className="text-white/40" aria-hidden>
            |
          </span>
          <MemberAccountMenu />
          <span className="text-white/40" aria-hidden>
            |
          </span>
          <Link href="/about" className="font-semibold hover:text-amber">
            Contact Us
          </Link>
          <div className="ml-2 flex gap-2 border-l border-white/30 pl-3">
            <a href="#" className="hover:text-amber" aria-label="X / Twitter">
              𝕏
            </a>
            <a href="#" className="hover:text-amber" aria-label="Facebook">
              f
            </a>
            <a href="#" className="hover:text-amber" aria-label="Instagram">
              ◎
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
