import { getLiveBangladeshHighlight } from "@/lib/cricket/services/bangladesh-last-match";
import { getMatchHighlight, type MatchHighlight } from "@/lib/cricket/services/match-highlight";

export type MatchChatMatchState = {
  isLive: boolean;
  isCompleted: boolean;
  title?: string;
};

export type MatchChatStateOptions = {
  /** Client already knows this fixture is live (match-centre poll). */
  liveHint?: boolean;
};

/** Resolve whether chat is open for this match. */
export async function resolveMatchChatState(
  matchId: string,
  options?: MatchChatStateOptions,
): Promise<MatchChatMatchState> {
  const [liveHighlight, highlight] = await Promise.all([
    getLiveBangladeshHighlight().catch(() => null),
    getMatchHighlight().catch(() => null),
  ]);

  const isCurrent = highlight?.matchId === matchId;
  const isLive =
    Boolean(options?.liveHint) ||
    liveHighlight?.matchId === matchId ||
    (isCurrent && highlight.mode === "live");
  const isCompleted = isCurrent && highlight.mode === "completed" && !isLive;

  return {
    isLive,
    isCompleted,
    title: isCurrent ? highlight?.title : undefined,
  };
}

export function matchChatStateFromHighlight(
  matchId: string,
  highlight: MatchHighlight | null | undefined,
  isLiveHint?: boolean,
): MatchChatMatchState {
  const isLive = Boolean(isLiveHint) || (highlight?.matchId === matchId && highlight.mode === "live");
  const isCurrent = highlight?.matchId === matchId;
  return {
    isLive,
    isCompleted: isCurrent && highlight?.mode === "completed" && !isLive,
    title: isCurrent ? highlight?.title : undefined,
  };
}
