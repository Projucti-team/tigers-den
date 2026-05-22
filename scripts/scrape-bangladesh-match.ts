/**
 * Updates data/bangladesh-last-match.json from CricAPI (one batch of requests).
 * Run nightly — not on every page load (saves API quota).
 *
 * Usage: npm run scrape:bangladesh-match
 */
import { scrapeBangladeshLastMatch } from "../lib/cricket/services/bangladesh-last-match";
import { BANGLADESH_LAST_MATCH_PATH } from "../lib/cricket/bangladesh-match-store";

async function main() {
  console.log("Fetching Bangladesh's last match from CricAPI…");
  const snapshot = await scrapeBangladeshLastMatch();

  if (!snapshot) {
    console.log("No match found. Existing cache kept (if any).");
    process.exit(1);
  }

  console.log(`Saved to ${BANGLADESH_LAST_MATCH_PATH}`);
  console.log(`  ${snapshot.highlight.title}`);
  console.log(`  ${snapshot.highlight.detailLine}`);
  console.log(`  ${snapshot.highlight.scoreLine}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
