import type { PublicMember } from "@/lib/social/types";

type StoredAuthor = {
  id?: number;
  username?: string;
  name?: string;
  avatarUrl?: string | null;
};

export type RoarMessageData = {
  body?: unknown;
  createdAt?: unknown;
  author?: unknown;
};

function toIsoString(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return (value.toDate as () => Date)().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string" && value) {
    return value;
  }
  return new Date().toISOString();
}

function toPublicAuthor(author: unknown): PublicMember {
  if (!author || typeof author !== "object") {
    return { id: 0, username: "member", name: "Member" };
  }

  const value = author as StoredAuthor;
  return {
    id: typeof value.id === "number" ? value.id : 0,
    username: typeof value.username === "string" ? value.username : "member",
    name: typeof value.name === "string" ? value.name : "Member",
    avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
  };
}

export function parseRoarMessage(id: string, data: RoarMessageData) {
  return {
    id,
    body: String(data.body ?? ""),
    createdAt: toIsoString(data.createdAt),
    author: toPublicAuthor(data.author),
  };
}
