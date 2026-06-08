import { resolveMemberId, toPublicMember } from "@/lib/social/member-record";
import {
  isCommentTargetType,
  type CommentTargetType,
  type StandComment,
} from "@/lib/stand/engagement-types";
import { getPayloadClient } from "@/lib/payload";
import type { Member, StandComment as StandCommentDoc } from "@/payload-types";
import type { Where } from "payload";

function toStandComment(doc: StandCommentDoc): StandComment {
  const author =
    typeof doc.author === "object" && doc.author
      ? toPublicMember(doc.author as Member)
      : {
          id: resolveMemberId(doc.author),
          username: "member",
          name: "Member",
        };

  return {
    id: doc.id,
    body: String(doc.body),
    createdAt: String(doc.createdAt),
    author,
  };
}

export async function getCommentCount(
  targetType: CommentTargetType,
  targetId: number,
): Promise<number> {
  const payload = await getPayloadClient();
  const result = await payload.count({
    collection: "stand-comments",
    where: {
      and: [
        { targetType: { equals: targetType } },
        { targetId: { equals: targetId } },
      ],
    },
    overrideAccess: true,
  });
  return result.totalDocs;
}

export async function getCommentCounts(
  targets: { targetType: CommentTargetType; targetId: number }[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!targets.length) return map;

  for (const t of targets) {
    map.set(`${t.targetType}:${t.targetId}`, 0);
  }

  const payload = await getPayloadClient();
  const or = targets.map(
    (t) =>
      ({
        targetType: { equals: t.targetType },
        targetId: { equals: t.targetId },
      }) satisfies Where,
  );

  const result = await payload.find({
    collection: "stand-comments",
    where: { or },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  });

  for (const doc of result.docs as StandCommentDoc[]) {
    const key = `${doc.targetType}:${doc.targetId}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return map;
}

export async function listComments(
  targetType: CommentTargetType,
  targetId: number,
  limit = 50,
): Promise<StandComment[]> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "stand-comments",
    where: {
      and: [
        { targetType: { equals: targetType } },
        { targetId: { equals: targetId } },
      ],
    },
    sort: "createdAt",
    limit,
    depth: 2,
    overrideAccess: true,
  });

  return (result.docs as StandCommentDoc[]).map(toStandComment);
}

export async function createComment(
  author: Member,
  targetType: CommentTargetType,
  targetId: number,
  body: string,
): Promise<StandComment> {
  if (!isCommentTargetType(targetType)) {
    throw new Error("INVALID_TARGET");
  }

  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("EMPTY_COMMENT");
  }
  if (trimmed.length > 2000) {
    throw new Error("COMMENT_TOO_LONG");
  }

  const payload = await getPayloadClient();
  const doc = await payload.create({
    collection: "stand-comments",
    overrideAccess: true,
    depth: 2,
    data: {
      targetType,
      targetId,
      author: author.id,
      body: trimmed,
      createdAt: new Date().toISOString(),
    },
  });

  return toStandComment(doc as StandCommentDoc);
}

export async function deleteComment(commentId: number, memberId: number): Promise<void> {
  const payload = await getPayloadClient();
  const doc = await payload.findByID({
    collection: "stand-comments",
    id: commentId,
    depth: 0,
    overrideAccess: true,
  });

  if (!doc) throw new Error("NOT_FOUND");
  const authorId = resolveMemberId((doc as StandCommentDoc).author);
  if (authorId !== memberId) throw new Error("FORBIDDEN");

  await payload.delete({
    collection: "stand-comments",
    id: commentId,
    overrideAccess: true,
  });
}
