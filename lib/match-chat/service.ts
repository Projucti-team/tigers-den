import { resolveMemberId, toPublicMember } from "@/lib/social/member-record";
import { getPayloadClient } from "@/lib/payload";
import {
  MATCH_CHAT_MESSAGE_MAX,
  MATCH_CHAT_POST_MATCH_MS,
  type MatchChatMessage,
  type MatchChatSnapshot,
} from "@/lib/match-chat/types";
import type { Member } from "@/payload-types";

type MatchChatRoomDoc = {
  id: number;
  matchId: string;
  title: string;
  endedAt?: string | null;
};

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

export function canPostInChat(room: Pick<MatchChatRoomDoc, "endedAt">, isLive: boolean): boolean {
  if (isLive) return true;
  if (!room.endedAt) return false;
  const ended = new Date(room.endedAt).getTime();
  if (Number.isNaN(ended)) return false;
  return Date.now() < ended + MATCH_CHAT_POST_MATCH_MS;
}

type MatchChatRoomState = {
  isLive: boolean;
  isCompleted: boolean;
};

export async function syncMatchChatRoom(
  matchId: string,
  title: string | undefined,
  state: MatchChatRoomState,
): Promise<MatchChatRoomDoc> {
  const { isLive, isCompleted } = state;
  const payload = await getPayloadClient();
  const existing = await payload.find({
    collection: "match-chat-rooms",
    where: { matchId: { equals: matchId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const doc = existing.docs[0] as MatchChatRoomDoc | undefined;
  const nowIso = new Date().toISOString();

  if (!doc) {
    const created = await payload.create({
      collection: "match-chat-rooms",
      overrideAccess: true,
      depth: 0,
      data: {
        matchId,
        title: title ?? "Bangladesh match",
      },
    });
    return created as MatchChatRoomDoc;
  }

  const data: { title?: string; endedAt?: string | null } = {};
  if (title) data.title = title;
  if (isLive) {
    data.endedAt = null;
  } else if (isCompleted && !doc.endedAt) {
    data.endedAt = nowIso;
  }

  const updated = await payload.update({
    collection: "match-chat-rooms",
    id: doc.id,
    overrideAccess: true,
    depth: 0,
    data,
  });

  return updated as MatchChatRoomDoc;
}

export async function listMatchChatMessages(
  matchId: string,
  limit = 120,
): Promise<MatchChatMessage[]> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "match-chat-messages",
    where: { matchId: { equals: matchId } },
    sort: "createdAt",
    limit,
    depth: 2,
    overrideAccess: true,
  });

  return (result.docs as MatchChatMessageDoc[]).map(toChatMessage);
}

export async function createMatchChatMessage(
  author: Member,
  matchId: string,
  body: string,
  isLive: boolean,
): Promise<MatchChatMessage> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("EMPTY_MESSAGE");
  if (trimmed.length > MATCH_CHAT_MESSAGE_MAX) throw new Error("MESSAGE_TOO_LONG");

  const payload = await getPayloadClient();
  const roomResult = await payload.find({
    collection: "match-chat-rooms",
    where: { matchId: { equals: matchId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const room = roomResult.docs[0] as MatchChatRoomDoc | undefined;
  if (!room || !canPostInChat(room, isLive)) {
    throw new Error("CHAT_CLOSED");
  }

  const doc = await payload.create({
    collection: "match-chat-messages",
    overrideAccess: true,
    depth: 2,
    data: {
      matchId,
      author: author.id,
      body: trimmed,
      createdAt: new Date().toISOString(),
    },
  });

  return toChatMessage(doc as MatchChatMessageDoc);
}

export async function getMatchChatSnapshot(
  matchId: string,
  title: string | undefined,
  state: MatchChatRoomState,
): Promise<MatchChatSnapshot> {
  const room = await syncMatchChatRoom(matchId, title, state);
  const { isLive } = state;
  const messages = await listMatchChatMessages(matchId);

  return {
    matchId,
    matchTitle: String(room.title || title),
    canPost: canPostInChat(room, isLive),
    isLive,
    endedAt: room.endedAt ? String(room.endedAt) : null,
    messages,
  };
}
