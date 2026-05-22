"use client";

import { useState } from "react";

import { mockChat } from "@/lib/data";

export function LiveChat() {
  const [message, setMessage] = useState("");

  return (
    <section className="fan-card flex h-full min-h-[420px] flex-col">
      <div className="fan-card-header-red px-4 py-3">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wider md:text-base">
          📣 The Roar — Live Chat
        </h2>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-crimson/5 to-emerald/5 p-4">
        {mockChat.map((entry, i) => (
          <div
            key={entry.user}
            className={
              i % 2 === 0
                ? "rounded-xl border-l-4 border-emerald bg-emerald/10 p-3 shadow-sm"
                : "rounded-xl border-l-4 border-crimson bg-crimson/10 p-3 shadow-sm"
            }
          >
            <p
              className={`font-display text-xs font-extrabold uppercase ${i % 2 === 0 ? "text-emerald" : "text-crimson"}`}
            >
              💬 {entry.user}
            </p>
            <p className="mt-1 text-sm font-medium text-charcoal">&ldquo;{entry.message}&rdquo;</p>
          </div>
        ))}
      </div>

      <form
        className="border-t-4 border-amber bg-gradient-to-r from-emerald/20 to-crimson/20 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage("");
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Type message
        </label>
        <div className="flex gap-2">
          <input
            id="chat-input"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="🔥 Type your roar..."
            className="flex-1 rounded-lg border-2 border-emerald bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/30"
          />
          <button
            type="submit"
            className="fan-btn-green shrink-0 rounded-lg px-4 py-2.5 text-xs hover:translate-y-0.5"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
