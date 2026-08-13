"use client";

import { useState } from "react";
import { FeedbackModal } from "./FeedbackModal";

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-lg transition-all hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
        title="Send feedback or report a bug"
        aria-label="Send feedback"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="m8 3 1.88 1.88M14.12 4.88 16 3M9 8.13V7a3 3 0 1 1 6 0v1.13M12 21c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6ZM12 21v-9M6.53 10c-1.93-.2-3.53-1.9-3.53-4M6 14H2M3 22c0-2.1 1.7-3.9 3.8-4M20.97 6c0 2.1-1.6 3.8-3.5 4M22 14h-4M17.2 18c2.1.1 3.8 1.9 3.8 4"
          />
        </svg>
      </button>

      {isOpen && <FeedbackModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
