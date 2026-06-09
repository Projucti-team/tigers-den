import * as initialSchema from "./20260524_000000_initial_schema";
import * as standEngagement from "./20260608_000000_stand_engagement";
import * as matchChat from "./20260610_000000_match_chat";
import * as matchChatPayloadRels from "./20260611_000000_match_chat_payload_rels";

export const migrations = [
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
];
