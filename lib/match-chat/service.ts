import { ensureSqliteMatchChatTables } from "@/lib/payload-ensure-sqlite-schema";
import { resolveMemberId, toPublicMember } from "@/lib/social/member-record";
import { getPayloadClient } from "@/lib/payload";
import {
  MATCH_CHAT_MESSAGE_MAX,
  THE_ROAR_CHAT_ID,
  THE_ROAR_CHAT_TITLE,
  type MatchChatMessage,
  type MatchChatSnapshot,
} from "@/lib/match-chat/types";
import type { Member } from "@/payload-types";

const MESSAGE_LIMIT = 120;

type MatchChatMessageDoc = {
  id: number;
  body: string;
  createdAt: string;
  author: number | Member;
};

function toChatMessage(doc: MatchChatMessageDoc): MatchChatMessage {
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

/**
 * The Roar is one always-open conversation — no per-match rooms or
 * open/close lifecycle. Messages from old match rooms stay in the stream.
 */
export async function getMatchChatSnapshot(): Promise<MatchChatSnapshot> {
  await ensureSqliteMatchChatTables().catch(() => undefined);

  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "match-chat-messages",
    sort: "-createdAt",
    limit: MESSAGE_LIMIT,
    depth: 2,
    overrideAccess: true,
  });

  const messages = (result.docs as MatchChatMessageDoc[]).map(toChatMessage).reverse();

  return {
    matchId: THE_ROAR_CHAT_ID,
    matchTitle: THE_ROAR_CHAT_TITLE,
    canPost: true,
    isLive: true,
    endedAt: null,
    messages,
  };
}

export async function createMatchChatMessage(
  author: Member,
  body: string,
): Promise<MatchChatMessage> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("EMPTY_MESSAGE");
  if (trimmed.length > MATCH_CHAT_MESSAGE_MAX) throw new Error("MESSAGE_TOO_LONG");

  const payload = await getPayloadClient();

  const doc = await payload.create({
    collection: "match-chat-messages",
    overrideAccess: true,
    depth: 2,
    data: {
      matchId: THE_ROAR_CHAT_ID,
      author: author.id,
      body: trimmed,
      createdAt: new Date().toISOString(),
    },
  });

  return toChatMessage(doc as MatchChatMessageDoc);
}
