/** @deprecated Import from @/lib/cricket/squads/types — kept for existing imports. */
export type { SquadPlayer, SeriesSquad } from "@/lib/cricket/squads/types";
export {
  cricinfoPlayerUrl,
  mergeSquads as mergeCuratedSquads,
  normalizeSquadPlayers,
  squadKey,
} from "@/lib/cricket/squads/types";
export {
  applyEspnTourSquads as applyCuratedTourSquads,
  fetchEspnTourSquads,
  loadEspnTourSquadsFromCache,
  refreshEspnTourSquads,
} from "@/lib/cricket/providers/espn-squads";
