import type { PublicMember } from "@/lib/social/types";

export const MATCH_CHAT_POST_MATCH_MS = 30 * 60 * 1000;
export const MATCH_CHAT_MESSAGE_MAX = 500;

export type MatchChatMessage = {
  id: number;
  body: string;
  createdAt: string;
  author: PublicMember;
};

export type MatchChatSnapshot = {
  matchId: string;
  matchTitle: string;
  canPost: boolean;
  isLive: boolean;
  endedAt: string | null;
  messages: MatchChatMessage[];
};
