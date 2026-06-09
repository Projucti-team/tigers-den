"use client";

import { useEffect, useRef, useState } from "react";

import { CHAT_EMOJI_GROUPS } from "@/lib/match-chat/emojis";

type ChatEmojiPickerProps = {
  onPick: (emoji: string) => void;
  disabled?: boolean;
};

export function ChatEmojiPicker({ onPick, disabled = false }: ChatEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
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

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-full min-h-[42px] items-center justify-center rounded-lg border-2 border-emerald bg-white px-2.5 text-lg transition-colors hover:bg-emerald/10 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={open ? "Close emoji picker" : "Add emoji"}
        aria-expanded={open}
      >
        <span aria-hidden>😊</span>
      </button>

      {open ? (
        <div
          className="absolute bottom-full right-0 z-20 mb-2 w-[min(100vw-2rem,15rem)] rounded-lg border-2 border-emerald bg-white p-2 shadow-lg"
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
        </div>
      ) : null}
    </div>
  );
}
