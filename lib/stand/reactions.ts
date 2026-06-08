import { resolveMemberId, toPublicMember } from "@/lib/social/member-record";
import {
  emptyReactionTotals,
  isReactionId,
  isReactionTargetType,
  type ReactionId,
  type ReactionSummary,
  type ReactionTargetType,
} from "@/lib/stand/engagement-types";
import { getPayloadClient } from "@/lib/payload";
import type { Member, StandReaction } from "@/payload-types";
import type { Where } from "payload";

function targetKey(targetType: ReactionTargetType, targetId: number): string {
  return `${targetType}:${targetId}`;
}

function summarizeRows(
  rows: StandReaction[],
  viewerId?: number,
): ReactionSummary {
  const totals = emptyReactionTotals();
  let userReaction: ReactionId | null = null;

  for (const row of rows) {
    const id = row.reaction as ReactionId;
    if (!isReactionId(id)) continue;
    totals[id] += 1;
    const memberId = resolveMemberId(row.member);
    if (viewerId && memberId === viewerId) {
      userReaction = id;
    }
  }

  const totalCount = Object.values(totals).reduce((sum, n) => sum + n, 0);
  return { totals, totalCount, userReaction };
}

export async function getReactionSummary(
  targetType: ReactionTargetType,
  targetId: number,
  viewerId?: number,
): Promise<ReactionSummary> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "stand-reactions",
    where: {
      and: [
        { targetType: { equals: targetType } },
        { targetId: { equals: targetId } },
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });

  return summarizeRows(result.docs as StandReaction[], viewerId);
}

export async function getReactionSummaries(
  targets: { targetType: ReactionTargetType; targetId: number }[],
  viewerId?: number,
): Promise<Map<string, ReactionSummary>> {
  const map = new Map<string, ReactionSummary>();
  if (!targets.length) return map;

  const payload = await getPayloadClient();
  const or = targets.map(
    (t) =>
      ({
        targetType: { equals: t.targetType },
        targetId: { equals: t.targetId },
      }) satisfies Where,
  );

  const result = await payload.find({
    collection: "stand-reactions",
    where: { or },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  });

  const grouped = new Map<string, StandReaction[]>();
  for (const t of targets) {
    grouped.set(targetKey(t.targetType, t.targetId), []);
  }

  for (const row of result.docs as StandReaction[]) {
    const key = targetKey(row.targetType as ReactionTargetType, row.targetId);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(row);
  }

  for (const [key, rows] of grouped) {
    map.set(key, summarizeRows(rows, viewerId));
  }

  return map;
}

export async function setReaction(
  member: Member,
  targetType: ReactionTargetType,
  targetId: number,
  reaction: ReactionId,
): Promise<ReactionSummary> {
  if (!isReactionTargetType(targetType) || !isReactionId(reaction)) {
    throw new Error("INVALID_REACTION");
  }

  const payload = await getPayloadClient();
  const existing = await payload.find({
    collection: "stand-reactions",
    where: {
      and: [
        { targetType: { equals: targetType } },
        { targetId: { equals: targetId } },
        { member: { equals: member.id } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const row = existing.docs[0] as StandReaction | undefined;

  if (row) {
    if (row.reaction === reaction) {
      await payload.delete({
        collection: "stand-reactions",
        id: row.id,
        overrideAccess: true,
      });
    } else {
      await payload.update({
        collection: "stand-reactions",
        id: row.id,
        overrideAccess: true,
        data: {
          reaction,
          createdAt: new Date().toISOString(),
        },
      });
    }
  } else {
    await payload.create({
      collection: "stand-reactions",
      overrideAccess: true,
      data: {
        targetType,
        targetId,
        member: member.id,
        reaction,
        createdAt: new Date().toISOString(),
      },
    });
  }

  return getReactionSummary(targetType, targetId, member.id);
}
