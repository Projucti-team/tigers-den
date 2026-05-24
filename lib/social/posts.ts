import {
  getMemberByUsername,
  mediaUrlsFromPost,
  resolveMemberId,
  toPublicMember,
} from "@/lib/social/member-record";
import { getFollowingIds } from "@/lib/social/follows";
import type { SocialPost } from "@/lib/social/types";
import { getPayloadClient } from "@/lib/payload";
import type { Member, MemberPost } from "@/payload-types";

function toSocialPost(doc: MemberPost): SocialPost {
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
    imageUrls: mediaUrlsFromPost(doc.images),
  };
}

export async function createMemberPost(
  author: Member,
  body: string,
  imageIds: number[] = [],
): Promise<SocialPost> {
  const payload = await getPayloadClient();
  const trimmed = body.trim();
  if (!trimmed && imageIds.length === 0) {
    throw new Error("EMPTY_POST");
  }

  const doc = await payload.create({
    collection: "member-posts",
    overrideAccess: true,
    depth: 2,
    data: {
      author: author.id,
      body: trimmed || "📷",
      images: imageIds,
      createdAt: new Date().toISOString(),
    },
  });

  return toSocialPost(doc as MemberPost);
}

export async function getPostsForUsername(
  username: string,
  limit = 30,
): Promise<SocialPost[]> {
  const member = await getMemberByUsername(username);
  if (!member) return [];

  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "member-posts",
    where: { author: { equals: member.id } },
    sort: "-createdAt",
    limit,
    depth: 2,
    overrideAccess: true,
  });

  return (result.docs as MemberPost[]).map(toSocialPost);
}

export async function getFeedForMember(viewer: Member, limit = 40): Promise<SocialPost[]> {
  const followingIds = await getFollowingIds(viewer.id);
  const authorIds = [viewer.id, ...followingIds];

  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "member-posts",
    where: { author: { in: authorIds } },
    sort: "-createdAt",
    limit,
    depth: 2,
    overrideAccess: true,
  });

  return (result.docs as MemberPost[]).map(toSocialPost);
}

/** Public timeline — all member posts, newest first. */
export async function getTimelinePosts(limit = 50): Promise<SocialPost[]> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "member-posts",
    sort: "-createdAt",
    limit,
    depth: 2,
    overrideAccess: true,
  });

  return (result.docs as MemberPost[]).map(toSocialPost);
}
