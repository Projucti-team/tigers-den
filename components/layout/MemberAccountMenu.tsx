"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { getMemberDisplayName } from "@/lib/members/display-name";
import { JOIN_PAGE_PATH, PROFILE_PAGE_PATH } from "@/lib/site-content";

export function MemberAccountMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const displayName = getMemberDisplayName(session?.user?.name, session?.user?.email);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (status !== "authenticated") {
    return (
      <Link href={JOIN_PAGE_PATH} className="font-semibold hover:text-amber">
        My Account
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="max-w-[140px] truncate font-semibold hover:text-amber sm:max-w-[200px]"
        title={displayName}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {displayName}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-[100] mt-2 min-w-[160px] overflow-hidden rounded border-2 border-emerald bg-white py-1 shadow-lg"
        >
          <Link
            href={PROFILE_PAGE_PATH}
            role="menuitem"
            className="block px-4 py-2.5 text-sm font-semibold text-charcoal hover:bg-emerald/10 hover:text-emerald"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            className="block w-full border-t border-emerald/10 px-4 py-2.5 text-left text-sm font-semibold text-crimson hover:bg-crimson/5"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: JOIN_PAGE_PATH });
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
