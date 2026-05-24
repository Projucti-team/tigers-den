import {
  getMemberByUsername,
  resolveMemberId,
  toPublicMember,
} from "@/lib/social/member-record";
import type { MemberSearchResult } from "@/lib/social/types";
import { getPayloadClient } from "@/lib/payload";
import type { Member, MemberFollow } from "@/payload-types";

async function countFollowers(memberId: number): Promise<number> {
  const payload = await getPayloadClient();
  const result = await payload.count({
    collection: "member-follows",
    where: { following: { equals: memberId } },
    overrideAccess: true,
  });
  return result.totalDocs;
}

async function countFollowing(memberId: number): Promise<number> {
  const payload = await getPayloadClient();
  const result = await payload.count({
    collection: "member-follows",
    where: { follower: { equals: memberId } },
    overrideAccess: true,
  });
  return result.totalDocs;
}

async function isFollowing(followerId: number, followingId: number): Promise<boolean> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "member-follows",
    where: {
      and: [
        { follower: { equals: followerId } },
        { following: { equals: followingId } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  return result.docs.length > 0;
}

export async function getFollowingIds(memberId: number): Promise<number[]> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "member-follows",
    where: { follower: { equals: memberId } },
    limit: 500,
    overrideAccess: true,
  });

  return result.docs
    .map((row) => {
      const follow = row as MemberFollow;
      return resolveMemberId(follow.following);
    })
    .filter((id) => id !== memberId);
}

export async function followMember(
  follower: Member,
  targetUsername: string,
): Promise<void> {
  const target = await getMemberByUsername(targetUsername);
  if (!target) throw new Error("USER_NOT_FOUND");
  if (target.id === follower.id) throw new Error("CANNOT_FOLLOW_SELF");

  const payload = await getPayloadClient();
  const existing = await payload.find({
    collection: "member-follows",
    where: {
      and: [
        { follower: { equals: follower.id } },
        { following: { equals: target.id } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  if (existing.docs.length) return;

  await payload.create({
    collection: "member-follows",
    overrideAccess: true,
    data: {
      follower: follower.id,
      following: target.id,
      createdAt: new Date().toISOString(),
    },
  });
}

export async function unfollowMember(
  follower: Member,
  targetUsername: string,
): Promise<void> {
  const target = await getMemberByUsername(targetUsername);
  if (!target) throw new Error("USER_NOT_FOUND");

  const payload = await getPayloadClient();
  const existing = await payload.find({
    collection: "member-follows",
    where: {
      and: [
        { follower: { equals: follower.id } },
        { following: { equals: target.id } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  const row = existing.docs[0];
  if (!row) return;

  await payload.delete({
    collection: "member-follows",
    id: row.id,
    overrideAccess: true,
  });
}

export async function enrichMemberSearch(
  doc: Member,
  viewerId?: number,
): Promise<MemberSearchResult> {
  const [followerCount, followingCount, following] = await Promise.all([
    countFollowers(doc.id),
    countFollowing(doc.id),
    viewerId ? isFollowing(viewerId, doc.id) : Promise.resolve(false),
  ]);

  return {
    ...toPublicMember(doc),
    followerCount,
    followingCount,
    isFollowing: following,
  };
}

export async function searchMembers(
  query: string,
  viewerId?: number,
  limit = 12,
): Promise<MemberSearchResult[]> {
  const payload = await getPayloadClient();
  const q = query.trim();
  if (!q) return [];

  const result = await payload.find({
    collection: "members",
    where: {
      or: [
        { username: { contains: q.toLowerCase() } },
        { name: { contains: q } },
      ],
    },
    limit,
    depth: 1,
    overrideAccess: true,
  });

  return Promise.all(
    (result.docs as Member[]).map((doc) => enrichMemberSearch(doc, viewerId)),
  );
}
