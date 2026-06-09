import { getPayloadClient } from "@/lib/payload";
import { MATCH_CHAT_POST_MATCH_MS } from "@/lib/match-chat/types";

export type MatchChatRoomDoc = {
  id: number;
  matchId: string;
  title: string;
  endedAt?: string | null;
};

export type MatchChatRoomState = {
  isLive: boolean;
  isCompleted: boolean;
};

export function canPostFromRoom(room: Pick<MatchChatRoomDoc, "endedAt">): boolean {
  if (!room.endedAt) return true;
  const ended = new Date(room.endedAt).getTime();
  if (Number.isNaN(ended)) return false;
  return Date.now() < ended + MATCH_CHAT_POST_MATCH_MS;
}

export function roomIsLive(room: Pick<MatchChatRoomDoc, "endedAt">): boolean {
  return !room.endedAt;
}

export async function findRoomByMatchId(matchId: string): Promise<MatchChatRoomDoc | null> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "match-chat-rooms",
    where: { matchId: { equals: matchId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  return (result.docs[0] as MatchChatRoomDoc | undefined) ?? null;
}

async function listRecentRooms(limit = 12): Promise<MatchChatRoomDoc[]> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "match-chat-rooms",
    sort: "-updatedAt",
    limit,
    depth: 0,
    overrideAccess: true,
  });
  return result.docs as MatchChatRoomDoc[];
}

export async function findOpenChatMatchId(): Promise<string | null> {
  const rooms = await listRecentRooms();
  for (const room of rooms) {
    if (canPostFromRoom(room)) return room.matchId;
  }
  return null;
}

export async function findRecentChatMatchId(): Promise<string | null> {
  const rooms = await listRecentRooms(1);
  return rooms[0]?.matchId ?? null;
}
