import type { PublicMember } from "@/lib/social/types";

/** Content that can receive reactions */
export type ReactionTargetType = "member-post" | "stand-discussion" | "chant";

/** Content that can receive comments */
export type CommentTargetType = "member-post" | "stand-discussion";

export const REACTION_OPTIONS = [
  { id: "roar", label: "Roar", emoji: "🐯" },
  { id: "love", label: "Love", emoji: "❤️" },
  { id: "fire", label: "Fire", emoji: "🔥" },
  { id: "clap", label: "Clap", emoji: "👏" },
  { id: "hundred", label: "Hundred", emoji: "💯" },
] as const;

export type ReactionId = (typeof REACTION_OPTIONS)[number]["id"];

export const REACTION_IDS = REACTION_OPTIONS.map((r) => r.id) as ReactionId[];

export function isReactionId(value: string): value is ReactionId {
  return (REACTION_IDS as string[]).includes(value);
}

export function isReactionTargetType(value: string): value is ReactionTargetType {
  return value === "member-post" || value === "stand-discussion" || value === "chant";
}

export function isCommentTargetType(value: string): value is CommentTargetType {
  return value === "member-post" || value === "stand-discussion";
}

export function emptyReactionTotals(): Record<ReactionId, number> {
  return { roar: 0, love: 0, fire: 0, clap: 0, hundred: 0 };
}

export type ReactionSummary = {
  totals: Record<ReactionId, number>;
  totalCount: number;
  userReaction: ReactionId | null;
};

export type StandComment = {
  id: number;
  body: string;
  createdAt: string;
  author: PublicMember;
};

export type EngagementTarget = {
  targetType: ReactionTargetType;
  targetId: number;
};
