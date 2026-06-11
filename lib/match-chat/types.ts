import type { PublicMember } from "@/lib/social/types";

export const MATCH_CHAT_MESSAGE_MAX = 500;

/** Single always-open conversation — no per-match rooms. */
export const THE_ROAR_CHAT_ID = "the-roar";
export const THE_ROAR_CHAT_TITLE = "Bangladesh fans, all day every day";

export type MatchChatMessage = {
  id: number;
  body: string;
  createdAt: string;
  author: PublicMember;
};

export type MatchChatSnapshot = {
  matchId: string | null;
  matchTitle: string;
  canPost: boolean;
  isLive: boolean;
  endedAt: string | null;
  messages: MatchChatMessage[];
};
