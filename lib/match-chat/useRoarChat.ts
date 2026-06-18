"use client";

import {
  collection,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";

import { getClientFirestore } from "@/lib/firebase/client";
import { isFirebasePublicConfigured, ROAR_MESSAGES_COLLECTION } from "@/lib/firebase/config";
import { parseRoarMessage } from "@/lib/match-chat/message";
import { THE_ROAR_CHAT_ID, type MatchChatMessage } from "@/lib/match-chat/types";

const MESSAGE_LIMIT = 120;

export function useRoarChat() {
  const [messages, setMessages] = useState<MatchChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebasePublicConfigured()) {
      setError("Chat is not configured yet.");
      setLoading(false);
      return;
    }

    const db = getClientFirestore();
    const q = query(
      collection(db, ROAR_MESSAGES_COLLECTION),
      where("roomId", "==", THE_ROAR_CHAT_ID),
      orderBy("createdAt", "asc"),
      limitToLast(MESSAGE_LIMIT),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs.map((doc) => parseRoarMessage(doc.id, doc.data()));
        setMessages(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("[roar-chat]", err);
        setError("Could not load live chat. Refresh the page.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  return { messages, loading, error };
}
