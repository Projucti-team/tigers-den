export type SeriesStatus = "upcoming" | "active" | "finished";
export type TourStatus = "active" | "finished";

export interface TourSyncState {
  id: number;
  tour_id: string;
  tour_slug: string;
  current_status: TourStatus;
  test_series_status?: SeriesStatus | null;
  odi_series_status?: SeriesStatus | null;
  t20_series_status?: SeriesStatus | null;
  last_index_sync?: string | null;
  last_squad_sync_test?: string | null;
  last_squad_sync_odi?: string | null;
  last_squad_sync_t20?: string | null;
  squad_import_complete_test: boolean;
  squad_import_complete_odi: boolean;
  squad_import_complete_t20: boolean;
  /** Cricinfo series id the last sync actually resolved fixtures/squads from (informational). */
  espn_cricinfo_series_id?: number | null;
  /** ESPN core league id paired with espn_cricinfo_series_id. */
  espn_league_id?: number | null;
  /** Admin-pinned cricinfo series id — takes priority over auto-discovery when set. */
  espn_series_override?: number | null;
  /** Admin-pinned ESPNcricinfo story URL(s) (newline-separated) to scrape for squads when auto-discovery misses them. */
  squad_story_url?: string | null;
  /** Admin-pasted squad text (one team per line: "Team Name: Player1 (c), Player2 (wk), ..."). */
  manual_squad_text?: string | null;
  created_at: string;
  updated_at: string;
}

export type MatchType = "test" | "odi" | "t20";

export interface TourSyncStateUpdate {
  tour_id: string;
  tour_slug: string;
  current_status?: TourStatus;
  test_series_status?: SeriesStatus | null;
  odi_series_status?: SeriesStatus | null;
  t20_series_status?: SeriesStatus | null;
  last_index_sync?: string;
  last_squad_sync_test?: string;
  last_squad_sync_odi?: string;
  last_squad_sync_t20?: string;
  squad_import_complete_test?: boolean;
  squad_import_complete_odi?: boolean;
  squad_import_complete_t20?: boolean;
  espn_cricinfo_series_id?: number | null;
  espn_league_id?: number | null;
  espn_series_override?: number | null;
  squad_story_url?: string | null;
  manual_squad_text?: string | null;
}

export interface SquadRefreshTarget {
  tour_id: string;
  tour_slug: string;
  matchTypes: MatchType[];
}
