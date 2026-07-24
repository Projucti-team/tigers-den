import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";

import * as initialSchema from "./20260524_000000_initial_schema";
import * as standEngagement from "./20260608_000000_stand_engagement";
import * as matchChat from "./20260610_000000_match_chat";
import * as matchChatPayloadRels from "./20260611_000000_match_chat_payload_rels";
import * as payloadLockedDocumentsRelsFull from "./20260612_000000_payload_locked_documents_rels_full";
import * as cricketPlayers from "./20260616_000000_cricket_players";
import * as legalGlobals from "./20260617_000000_legal_globals";
import * as trackedPlayerLeagues from "./20260618_000000_tracked_player_leagues";
import * as tourSyncState from "./20260705_000000_tour_sync_state";
import * as tourSeriesOverride from "./20260723_000000_tour_series_override";
import * as tourSquadStoryUrl from "./20260723_000001_tour_squad_story_url";
import * as playersPhotoAliases from "./20260724_000000_players_photo_aliases";
import * as tourManualSquadText from "./20260724_000001_tour_manual_squad_text";

type Migration = {
  name: string;
  up: (args: MigrateUpArgs) => Promise<void>;
  down: (args: MigrateDownArgs) => Promise<void>;
};

export const migrations: Migration[] = [
  {
    name: "20260524_000000_initial_schema",
    up: initialSchema.up,
    down: initialSchema.down,
  },
  {
    name: "20260608_000000_stand_engagement",
    up: standEngagement.up,
    down: standEngagement.down,
  },
  {
    name: "20260610_000000_match_chat",
    up: matchChat.up,
    down: matchChat.down,
  },
  {
    name: "20260611_000000_match_chat_payload_rels",
    up: matchChatPayloadRels.up,
    down: matchChatPayloadRels.down,
  },
  {
    name: "20260612_000000_payload_locked_documents_rels_full",
    up: payloadLockedDocumentsRelsFull.up,
    down: payloadLockedDocumentsRelsFull.down,
  },
  {
    name: "20260616_000000_cricket_players",
    up: cricketPlayers.up,
    down: cricketPlayers.down,
  },
  {
    name: "20260617_000000_legal_globals",
    up: legalGlobals.up,
    down: legalGlobals.down,
  },
  {
    name: "20260618_000000_tracked_player_leagues",
    up: trackedPlayerLeagues.up,
    down: trackedPlayerLeagues.down,
  },
  {
    name: "20260705_000000_tour_sync_state",
    up: tourSyncState.up,
    down: tourSyncState.down,
  },
  {
    name: "20260723_000000_tour_series_override",
    up: tourSeriesOverride.up,
    down: tourSeriesOverride.down,
  },
  {
    name: "20260723_000001_tour_squad_story_url",
    up: tourSquadStoryUrl.up,
    down: tourSquadStoryUrl.down,
  },
  {
    name: "20260724_000000_players_photo_aliases",
    up: playersPhotoAliases.up,
    down: playersPhotoAliases.down,
  },
  {
    name: "20260724_000001_tour_manual_squad_text",
    up: tourManualSquadText.up,
    down: tourManualSquadText.down,
  },
];
