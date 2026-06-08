import { getCommentCounts } from "@/lib/stand/comments";
import { getReactionSummaries } from "@/lib/stand/reactions";
import type {
  CommentTargetType,
  ReactionSummary,
  ReactionTargetType,
} from "@/lib/stand/engagement-types";
import type { SocialPost } from "@/lib/social/types";

export async function attachPostEngagement(
  posts: SocialPost[],
  viewerId?: number,
): Promise<SocialPost[]> {
  if (!posts.length) return posts;

  const targets = posts.map((p) => ({
    targetType: "member-post" as const,
    targetId: p.id,
  }));

  const [reactions, commentCounts] = await Promise.all([
    getReactionSummaries(targets, viewerId),
    getCommentCounts(targets),
  ]);

  return posts.map((post) => {
    const key = `member-post:${post.id}`;
    return {
      ...post,
      reactions: reactions.get(key),
      commentCount: commentCounts.get(key) ?? 0,
    };
  });
}

export type ContentEngagement = {
  reactions: ReactionSummary;
  commentCount: number;
};

export async function getContentEngagement(
  targetType: ReactionTargetType,
  targetId: number,
  viewerId?: number,
  includeComments = targetType !== "chant",
): Promise<ContentEngagement> {
  const reactions = await getReactionSummaries(
    [{ targetType, targetId }],
    viewerId,
  );
  const key = `${targetType}:${targetId}`;

  let commentCount = 0;
  if (includeComments && (targetType === "member-post" || targetType === "stand-discussion")) {
    const counts = await getCommentCounts([
      { targetType: targetType as CommentTargetType, targetId },
    ]);
    commentCount = counts.get(key) ?? 0;
  }

  return {
    reactions: reactions.get(key) ?? {
      totals: { roar: 0, love: 0, fire: 0, clap: 0, hundred: 0 },
      totalCount: 0,
      userReaction: null,
    },
    commentCount,
  };
}
