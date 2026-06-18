import { isFirebaseChatConfigured } from "@/lib/firebase/config";
import { createRoarMessage, listRoarMessages } from "@/lib/match-chat/firestore";
import {
  THE_ROAR_CHAT_ID,
  THE_ROAR_CHAT_TITLE,
  type MatchChatSnapshot,
} from "@/lib/match-chat/types";
import type { Member } from "@/payload-types";

/**
 * The Roar is one always-open conversation — no per-match rooms or
 * open/close lifecycle. Messages live in Firestore for real-time sync.
 */
export async function getMatchChatSnapshot(): Promise<MatchChatSnapshot> {
  if (!isFirebaseChatConfigured()) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }

  const messages = await listRoarMessages();

  return {
    matchId: THE_ROAR_CHAT_ID,
    matchTitle: THE_ROAR_CHAT_TITLE,
    canPost: true,
    isLive: true,
    endedAt: null,
    messages,
  };
}

export async function createMatchChatMessage(
  author: Member,
  body: string,
) {
  if (!isFirebaseChatConfigured()) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }

  return createRoarMessage(author, body);
}
