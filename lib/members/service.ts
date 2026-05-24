import { MEMBER_COUNT_BASE } from "@/lib/members/constants";
import { allocateUsername } from "@/lib/social/member-record";
import { getPayloadClient } from "@/lib/payload";

export type MemberProvider = "google" | "facebook";

export type UpsertMemberInput = {
  email: string;
  name: string;
  provider: MemberProvider;
  providerAccountId?: string;
  imageUrl?: string | null;
};

export type MemberProfile = {
  email: string;
  name: string;
  country?: string | null;
  favoritePlayer?: string | null;
};

export async function upsertMemberFromOAuth(input: UpsertMemberInput): Promise<void> {
  const payload = await getPayloadClient();
  const email = input.email.trim().toLowerCase();

  const existing = await payload.find({
    collection: "members",
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  });

  const doc = existing.docs[0];

  if (doc) {
    await payload.update({
      collection: "members",
      id: doc.id,
      overrideAccess: true,
      data: {
        name: input.name || doc.name,
        provider: input.provider,
        providerAccountId: input.providerAccountId ?? doc.providerAccountId,
        imageUrl: input.imageUrl ?? doc.imageUrl,
      },
    });
    return;
  }

  const username = await allocateUsername(input.name || email.split("@")[0] || "tiger");

  await payload.create({
    collection: "members",
    overrideAccess: true,
    data: {
      email,
      username,
      name: input.name,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      imageUrl: input.imageUrl ?? undefined,
      joinedAt: new Date().toISOString(),
    },
  });
}

export async function getRealMemberCount(): Promise<number> {
  const payload = await getPayloadClient();
  const result = await payload.count({
    collection: "members",
    overrideAccess: true,
  });
  return result.totalDocs;
}

export async function getDisplayedMemberCount(): Promise<number> {
  const real = await getRealMemberCount();
  return MEMBER_COUNT_BASE + real;
}

export async function getMemberByEmail(email: string): Promise<MemberProfile | null> {
  const payload = await getPayloadClient();
  const normalized = email.trim().toLowerCase();

  const result = await payload.find({
    collection: "members",
    where: { email: { equals: normalized } },
    limit: 1,
    overrideAccess: true,
  });

  const doc = result.docs[0];
  if (!doc) return null;

  return {
    email: String(doc.email),
    name: String(doc.name),
    country: doc.country ? String(doc.country) : null,
    favoritePlayer: doc.favoritePlayer ? String(doc.favoritePlayer) : null,
  };
}

export async function updateMemberProfile(
  email: string,
  data: { country?: string; favoritePlayer?: string },
): Promise<MemberProfile | null> {
  const payload = await getPayloadClient();
  const normalized = email.trim().toLowerCase();

  const existing = await payload.find({
    collection: "members",
    where: { email: { equals: normalized } },
    limit: 1,
    overrideAccess: true,
  });

  const doc = existing.docs[0];
  if (!doc) return null;

  const country =
    data.country !== undefined ? data.country.trim() || undefined : doc.country;
  const favoritePlayer =
    data.favoritePlayer !== undefined
      ? data.favoritePlayer.trim() || undefined
      : doc.favoritePlayer;

  const updated = await payload.update({
    collection: "members",
    id: doc.id,
    overrideAccess: true,
    data: { country, favoritePlayer },
  });

  return {
    email: String(updated.email),
    name: String(updated.name),
    country: updated.country ? String(updated.country) : null,
    favoritePlayer: updated.favoritePlayer ? String(updated.favoritePlayer) : null,
  };
}
