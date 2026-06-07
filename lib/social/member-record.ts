import { isValidUsername, slugifyUsername } from "@/lib/members/username";
import { getPayloadClient } from "@/lib/payload";
import { getRelativeMediaUrl } from "@/lib/media";
import type { PublicMember } from "@/lib/social/types";
import type { Media, Member } from "@/payload-types";

export function resolveMemberId(value: number | Member): number {
  return typeof value === "number" ? value : value.id;
}

export function memberAvatarUrl(doc: Member): string | null {
  const media = doc.avatar;
  if (!media || typeof media === "number") return null;
  return getRelativeMediaUrl(media as Media);
}

export function toPublicMember(
  doc: Member,
  options?: { includeEmail?: boolean },
): PublicMember {
  return {
    id: doc.id,
    username: String(doc.username),
    name: String(doc.name),
    email: options?.includeEmail ? String(doc.email) : undefined,
    bio: doc.bio ? String(doc.bio) : null,
    avatarUrl: memberAvatarUrl(doc),
    country: doc.country ? String(doc.country) : null,
    favoritePlayer: doc.favoritePlayer ? String(doc.favoritePlayer) : null,
  };
}

async function usernameTaken(username: string, excludeId?: number): Promise<boolean> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "members",
    where: { username: { equals: username } },
    limit: 1,
    overrideAccess: true,
  });

  const doc = result.docs[0];
  if (!doc) return false;
  if (excludeId && doc.id === excludeId) return false;
  return true;
}

export async function allocateUsername(baseName: string, excludeId?: number): Promise<string> {
  const base = slugifyUsername(baseName);
  let candidate = base;
  let n = 0;

  while (await usernameTaken(candidate, excludeId)) {
    n += 1;
    candidate = `${base}-${n}`;
  }

  return candidate;
}

export async function ensureMemberUsername(doc: Member): Promise<Member> {
  if (doc.username) return doc;

  const payload = await getPayloadClient();
  const username = await allocateUsername(doc.name || doc.email, doc.id);

  return payload.update({
    collection: "members",
    id: doc.id,
    overrideAccess: true,
    data: { username },
  }) as Promise<Member>;
}

export async function getMemberByEmail(email: string, depth = 1): Promise<Member | null> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "members",
    where: { email: { equals: email.trim().toLowerCase() } },
    limit: 1,
    depth,
    overrideAccess: true,
  });

  const doc = result.docs[0] as Member | undefined;
  if (!doc) return null;
  return ensureMemberUsername(doc);
}

export async function getMemberByUsername(
  username: string,
  depth = 1,
): Promise<Member | null> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "members",
    where: { username: { equals: username.toLowerCase() } },
    limit: 1,
    depth,
    overrideAccess: true,
  });

  return (result.docs[0] as Member | undefined) ?? null;
}

export async function updateMemberUsername(
  memberId: number,
  raw: string,
): Promise<Member> {
  const username = slugifyUsername(raw);
  if (!isValidUsername(username)) {
    throw new Error("INVALID_USERNAME");
  }
  if (await usernameTaken(username, memberId)) {
    throw new Error("USERNAME_TAKEN");
  }

  const payload = await getPayloadClient();
  return payload.update({
    collection: "members",
    id: memberId,
    depth: 1,
    overrideAccess: true,
    data: { username },
  }) as Promise<Member>;
}

export async function setMemberAvatar(
  memberId: number,
  mediaId: number,
): Promise<Member> {
  const payload = await getPayloadClient();
  return payload.update({
    collection: "members",
    id: memberId,
    depth: 1,
    overrideAccess: true,
    data: { avatar: mediaId },
  }) as Promise<Member>;
}

export function mediaUrlsFromPost(images: (number | Media)[] | null | undefined): string[] {
  if (!images?.length) return [];
  return images
    .map((img) => getRelativeMediaUrl(typeof img === "number" ? null : img))
    .filter((url): url is string => Boolean(url));
}
