import { FieldValue, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { ROAR_MESSAGES_COLLECTION } from "@/lib/firebase/config";
import { parseRoarMessage } from "@/lib/match-chat/message";
import {
  MATCH_CHAT_MESSAGE_MAX,
  THE_ROAR_CHAT_ID,
  type MatchChatMessage,
} from "@/lib/match-chat/types";
import { toPublicMember } from "@/lib/social/member-record";
import type { Member } from "@/payload-types";

const MESSAGE_LIMIT = 120;

function toStoredAuthor(author: Member) {
  const publicAuthor = toPublicMember(author);
  return {
    id: publicAuthor.id,
    username: publicAuthor.username,
    name: publicAuthor.name,
    avatarUrl: publicAuthor.avatarUrl ?? null,
  };
}

export function docToMatchChatMessage(
  doc: QueryDocumentSnapshot<DocumentData>,
): MatchChatMessage {
  return parseRoarMessage(doc.id, doc.data());
}

export async function listRoarMessages(): Promise<MatchChatMessage[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(ROAR_MESSAGES_COLLECTION)
    .where("roomId", "==", THE_ROAR_CHAT_ID)
    .orderBy("createdAt", "asc")
    .limitToLast(MESSAGE_LIMIT)
    .get();

  return snapshot.docs.map(docToMatchChatMessage);
}

export async function createRoarMessage(
  author: Member,
  body: string,
): Promise<MatchChatMessage> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("EMPTY_MESSAGE");
  if (trimmed.length > MATCH_CHAT_MESSAGE_MAX) throw new Error("MESSAGE_TOO_LONG");

  const db = getAdminFirestore();
  const docRef = await db.collection(ROAR_MESSAGES_COLLECTION).add({
    roomId: THE_ROAR_CHAT_ID,
    body: trimmed,
    createdAt: FieldValue.serverTimestamp(),
    author: toStoredAuthor(author),
  });

  const created = await docRef.get();
  if (!created.exists) {
    throw new Error("MESSAGE_CREATE_FAILED");
  }

  return docToMatchChatMessage(created as QueryDocumentSnapshot<DocumentData>);
}
