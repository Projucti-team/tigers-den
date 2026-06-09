import { getLiveBangladeshHighlight } from "@/lib/cricket/services/bangladesh-last-match";
import { getMatchHighlight } from "@/lib/cricket/services/match-highlight";

import type { MatchChatRoomState } from "@/lib/match-chat/room";

export type MatchChatMatchState = MatchChatRoomState & {
  title?: string;
};

/** Cricket lookups for chat room lifecycle — cached, independent of scorecard polling. */
const CRICKET_CACHE_MS = 60_000;
const cricketCache = new Map<string, { at: number; state: MatchChatMatchState }>();

export async function resolveMatchChatState(matchId: string): Promise<MatchChatMatchState> {
  const hit = cricketCache.get(matchId);
  if (hit && Date.now() - hit.at < CRICKET_CACHE_MS) {
    return hit.state;
  }

  const [liveHighlight, highlight] = await Promise.all([
    getLiveBangladeshHighlight().catch(() => null),
    getMatchHighlight().catch(() => null),
  ]);

  const isCurrent = highlight?.matchId === matchId;
  const isLive =
    liveHighlight?.matchId === matchId ||
    (isCurrent && highlight.mode === "live");
  const isCompleted = isCurrent && highlight.mode === "completed" && !isLive;

  const state: MatchChatMatchState = {
    isLive,
    isCompleted,
    title: isCurrent ? highlight?.title : undefined,
  };

  cricketCache.set(matchId, { at: Date.now(), state });
  return state;
}

/** Bangladesh fixture that should have a chat room (cached cricket fetch). */
export async function resolveCurrentBangladeshChatMatch(): Promise<{
  matchId: string;
  state: MatchChatMatchState;
} | null> {
  const live = await getLiveBangladeshHighlight().catch(() => null);
  if (live) {
    const state: MatchChatMatchState = {
      isLive: true,
      isCompleted: false,
      title: live.title,
    };
    cricketCache.set(live.matchId, { at: Date.now(), state });
    return { matchId: live.matchId, state };
  }

  const highlight = await getMatchHighlight().catch(() => null);
  if (!highlight?.matchId) return null;

  const state: MatchChatMatchState = {
    isLive: false,
    isCompleted: highlight.mode === "completed",
    title: highlight.title,
  };
  cricketCache.set(highlight.matchId, { at: Date.now(), state });
  return { matchId: highlight.matchId, state };
}
