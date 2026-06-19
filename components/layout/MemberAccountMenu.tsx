"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getMemberDisplayName } from "@/lib/members/display-name";
import { JOIN_PAGE_PATH, PROFILE_PAGE_PATH } from "@/lib/site-content";

type MenuPosition = {
  top: number;
  left: number;
  minWidth: number;
};

export function MemberAccountMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = getMemberDisplayName(session?.user?.name, session?.user?.email);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 8,
      left: rect.left,
      minWidth: Math.max(rect.width, 180),
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    if (open) {
      document.addEventListener("mousedown", onClickOutside);
    }

    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (status !== "authenticated") {
    return (
      <Link href={JOIN_PAGE_PATH} className="font-semibold hover:text-amber">
        My Account
      </Link>
    );
  }

  const menu =
    open && menuPosition && mounted
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              minWidth: menuPosition.minWidth,
              zIndex: 200,
            }}
            className="overflow-hidden rounded border-2 border-emerald bg-white py-1 shadow-xl"
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
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex max-w-[140px] items-center gap-1 truncate font-semibold sm:max-w-[200px] ${
          open ? "text-amber" : "hover:text-amber"
        }`}
        title={displayName}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="truncate">{displayName}</span>
        <span className="shrink-0 text-[10px] opacity-80" aria-hidden>
          ▾
        </span>
      </button>
      {menu}
    </>
  );
}
