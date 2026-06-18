"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { ChatEmojiPicker } from "@/components/match-chat/ChatEmojiPicker";
import { formatPostTime } from "@/components/profile/format-time";
import { MemberAvatar } from "@/components/profile/MemberAvatar";
import { MATCH_CHAT_MESSAGE_MAX, THE_ROAR_CHAT_TITLE } from "@/lib/match-chat/types";
import { useRoarChat } from "@/lib/match-chat/useRoarChat";
import { formatMemberDisplayName } from "@/lib/members/display";
import { profilePath, JOIN_PAGE_PATH } from "@/lib/site-content";

export function LiveChat() {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";
  const { messages, loading, error } = useRoarChat();
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    if (!stickToBottom.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }

  function insertEmoji(emoji: string) {
    const input = inputRef.current;
    if (!input) {
      setMessage((prev) => (prev + emoji).slice(0, MATCH_CHAT_MESSAGE_MAX));
      return;
    }

    const start = input.selectionStart ?? message.length;
    const end = input.selectionEnd ?? message.length;
    const next = (message.slice(0, start) + emoji + message.slice(end)).slice(
      0,
      MATCH_CHAT_MESSAGE_MAX,
    );
    setMessage(next);
    if (postError) setPostError(null);

    const caret = Math.min(start + emoji.length, MATCH_CHAT_MESSAGE_MAX);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(caret, caret);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || !isLoggedIn) return;

    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch("/api/match-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPostError(data.error ?? "Could not send message. Try again.");
        return;
      }
      setMessage("");
      stickToBottom.current = true;
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="fan-card flex h-full min-h-[420px] flex-col">
      <div className="fan-card-header-red px-4 py-3">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wider md:text-base">
          📣 The Roar — Live Chat
        </h2>
        <p className="mt-1 truncate text-xs font-semibold text-white/80">
          {THE_ROAR_CHAT_TITLE}
        </p>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-crimson/5 to-emerald/5 p-4"
      >
        {loading && !messages.length ? (
          <p className="text-center text-sm text-charcoal/60">Loading The Roar…</p>
        ) : error ? (
          <p className="text-center text-sm font-semibold text-crimson">{error}</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-charcoal/60">
            No messages yet — be the first to roar for Bangladesh.
          </p>
        ) : (
          messages.map((entry, i) => (
            <div
              key={entry.id}
              className={
                i % 2 === 0
                  ? "rounded-xl border-l-4 border-emerald bg-emerald/10 p-3 shadow-sm"
                  : "rounded-xl border-l-4 border-crimson bg-crimson/10 p-3 shadow-sm"
              }
            >
              <div className="flex items-start gap-2">
                <Link href={profilePath(entry.author.username)} className="shrink-0">
                  <MemberAvatar
                    avatarUrl={entry.author.avatarUrl}
                    name={entry.author.name}
                    size="sm"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-display text-xs font-extrabold uppercase ${i % 2 === 0 ? "text-emerald" : "text-crimson"}`}
                  >
                    <Link
                      href={profilePath(entry.author.username)}
                      className="hover:underline"
                    >
                      {formatMemberDisplayName(entry.author.name)}
                    </Link>
                    <span className="ml-2 font-mono text-[10px] font-bold normal-case text-charcoal/45">
                      {formatPostTime(entry.createdAt)}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-charcoal">
                    {entry.body}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {!isLoggedIn ? (
        <div className="border-t-4 border-amber bg-gradient-to-r from-emerald/20 to-crimson/20 p-4 text-center">
          <p className="text-sm font-medium text-charcoal">
            You need to sign in to join The Roar and chat with fellow fans.
          </p>
          <Link
            href={JOIN_PAGE_PATH}
            className="fan-btn-green mt-3 inline-block rounded-lg px-6 py-2.5 text-xs font-extrabold uppercase"
          >
            Sign in to chat
          </Link>
        </div>
      ) : (
        <form
          className="border-t-4 border-amber bg-gradient-to-r from-emerald/20 to-crimson/20 p-3"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <label htmlFor="chat-input" className="sr-only">
            Type message
          </label>
          <div className="flex gap-2">
            <ChatEmojiPicker onPick={insertEmoji} disabled={posting || Boolean(error)} />
            <input
              ref={inputRef}
              id="chat-input"
              type="text"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (postError) setPostError(null);
              }}
              maxLength={MATCH_CHAT_MESSAGE_MAX}
              placeholder="🔥 Type your roar…"
              disabled={Boolean(error)}
              className="min-w-0 flex-1 rounded-lg border-2 border-emerald bg-white px-3 py-2.5 text-sm font-semibold text-charcoal placeholder:text-charcoal/45 outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={posting || !message.trim() || Boolean(error)}
              className="fan-btn-green shrink-0 rounded-lg px-4 py-2.5 text-xs hover:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {posting ? "…" : "Send"}
            </button>
          </div>
          {postError ? (
            <p className="mt-2 text-center text-xs font-semibold text-crimson">{postError}</p>
          ) : null}
        </form>
      )}
    </section>
  );
}
