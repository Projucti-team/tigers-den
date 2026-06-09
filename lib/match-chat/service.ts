import { ensureSqliteMatchChatTables } from "@/lib/payload-ensure-sqlite-schema";
import { resolveCurrentBangladeshChatMatch, resolveMatchChatState } from "@/lib/match-chat/match-state";
import {
  canPostFromRoom,
  findOpenChatMatchId,
  findRecentChatMatchId,
  findRoomByMatchId,
  roomIsLive,
  type MatchChatRoomDoc,
  type MatchChatRoomState,
} from "@/lib/match-chat/room";
import { resolveMemberId, toPublicMember } from "@/lib/social/member-record";
import { getPayloadClient } from "@/lib/payload";
import {
  MATCH_CHAT_MESSAGE_MAX,
  type MatchChatMessage,
  type MatchChatSnapshot,
} from "@/lib/match-chat/types";
import type { Member } from "@/payload-types";

type MatchChatMessageDoc = {
  id: number;
  body: string;
  createdAt: string;
  author: number | Member;
};

const EMPTY_SNAPSHOT: MatchChatSnapshot = {
  matchId: null,
  matchTitle: "The Roar",
  canPost: false,
  isLive: false,
  endedAt: null,
  messages: [],
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

function needsLifecycleSync(room: MatchChatRoomDoc, state: MatchChatRoomState): boolean {
  if (state.isLive && room.endedAt != null) return true;
  if (state.isCompleted && !room.endedAt) return true;
  return false;
}

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
        endedAt: isCompleted ? nowIso : undefined,
      },
    });
    return created as MatchChatRoomDoc;
  }

  const data: { title?: string; endedAt?: string | null } = {};
  if (title && title !== doc.title) data.title = title;
  if (isLive) {
    if (doc.endedAt != null) data.endedAt = null;
  } else if (isCompleted && !doc.endedAt) {
    data.endedAt = nowIso;
  }

  if (Object.keys(data).length === 0) {
    return doc;
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

async function resolveChatMatchId(requested?: string): Promise<string | null> {
  if (requested) return requested;

  const open = await findOpenChatMatchId();
  if (open) return open;

  const recent = await findRecentChatMatchId();
  if (recent) return recent;

  const current = await resolveCurrentBangladeshChatMatch();
  if (!current) return null;

  await syncMatchChatRoom(current.matchId, current.state.title, current.state);
  return current.matchId;
}

async function refreshRoomIfNeeded(
  matchId: string,
  room: MatchChatRoomDoc | null,
): Promise<MatchChatRoomDoc> {
  if (!room) {
    const state = await resolveMatchChatState(matchId);
    return syncMatchChatRoom(matchId, state.title, state);
  }

  // Open room: check cricket (cached) only to close when the match finishes.
  if (!room.endedAt) {
    const state = await resolveMatchChatState(matchId);
    if (needsLifecycleSync(room, state) || (state.title && state.title !== room.title)) {
      return syncMatchChatRoom(matchId, state.title, state);
    }
  }

  return room;
}

export async function getMatchChatSnapshot(requestedMatchId?: string): Promise<MatchChatSnapshot> {
  await ensureSqliteMatchChatTables().catch(() => undefined);

  const matchId = await resolveChatMatchId(requestedMatchId);
  if (!matchId) return EMPTY_SNAPSHOT;

  const [messages, existingRoom] = await Promise.all([
    listMatchChatMessages(matchId),
    findRoomByMatchId(matchId),
  ]);

  const room = await refreshRoomIfNeeded(matchId, existingRoom);

  return {
    matchId,
    matchTitle: String(room.title),
    canPost: canPostFromRoom(room),
    isLive: roomIsLive(room),
    endedAt: room.endedAt ? String(room.endedAt) : null,
    messages,
  };
}

export async function createMatchChatMessage(
  author: Member,
  matchId: string,
  body: string,
): Promise<MatchChatMessage> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("EMPTY_MESSAGE");
  if (trimmed.length > MATCH_CHAT_MESSAGE_MAX) throw new Error("MESSAGE_TOO_LONG");

  const state = await resolveMatchChatState(matchId);
  const room = await syncMatchChatRoom(matchId, state.title, state);
  if (!canPostFromRoom(room)) {
    throw new Error("CHAT_CLOSED");
  }

  const payload = await getPayloadClient();

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
