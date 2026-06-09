"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CHAT_EMOJI_GROUPS } from "@/lib/match-chat/emojis";

type ChatEmojiPickerProps = {
  onPick: (emoji: string) => void;
  disabled?: boolean;
};

const PANEL_WIDTH_PX = 240;

export function ChatEmojiPicker({ onPick, disabled = false }: ChatEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function updatePosition() {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    let left = rect.left;
    if (left + PANEL_WIDTH_PX > window.innerWidth - 8) {
      left = window.innerWidth - PANEL_WIDTH_PX - 8;
    }
    left = Math.max(8, left);
    setCoords({ top: rect.top - 8, left });
  }

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  function pick(emoji: string) {
    onPick(emoji);
    setOpen(false);
  }

  const panel =
    open && coords
      ? createPortal(
          <div
            ref={panelRef}
            className="rounded-lg border-2 border-emerald bg-white p-2 shadow-xl"
            style={{
              position: "fixed",
              left: coords.left,
              top: coords.top,
              width: PANEL_WIDTH_PX,
              transform: "translateY(-100%)",
              zIndex: 9999,
            }}
            role="listbox"
            aria-label="Choose an emoji"
          >
            {CHAT_EMOJI_GROUPS.map((group) => (
              <div key={group.label} className="mb-2 last:mb-0">
                <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-charcoal/50">
                  {group.label}
                </p>
                <div className="grid grid-cols-6 gap-0.5">
                  {group.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      role="option"
                      className="rounded-md p-1.5 text-lg leading-none transition-colors hover:bg-emerald/15 active:scale-95"
                      onClick={() => pick(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-full min-h-[42px] shrink-0 items-center justify-center rounded-lg border-2 border-emerald bg-white px-2.5 text-lg transition-colors hover:bg-emerald/10 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={open ? "Close emoji picker" : "Add emoji"}
        aria-expanded={open}
      >
        <span aria-hidden>😊</span>
      </button>
      {panel}
    </>
  );
}
