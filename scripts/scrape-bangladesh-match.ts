/**
 * Updates data/bangladesh-last-match.json from CricAPI (one batch of requests).
 * Run nightly — not on every page load (saves API quota).
 *
 * Usage: npm run scrape:bangladesh-match
 */
import { BANGLADESH_LAST_MATCH_PATH } from "../lib/cricket/bangladesh-match-store";
import { BANGLADESH_UPCOMING_MATCHES_PATH } from "../lib/cricket/upcoming-matches-store";
import { scrapeBangladeshLastMatch } from "../lib/cricket/services/bangladesh-last-match";
import { scrapeBangladeshUpcomingMatches } from "../lib/cricket/services/bangladesh-upcoming-matches";
import { formatUpcomingMatchMarqueeLine } from "../lib/cricket/services/marquee-format";

async function main() {
  console.log("Fetching Bangladesh's last match from CricAPI…");
  const snapshot = await scrapeBangladeshLastMatch();

  if (!snapshot) {
    console.log("No last match found. Existing cache kept (if any).");
  } else {
    console.log(`Saved to ${BANGLADESH_LAST_MATCH_PATH}`);
    console.log(`  ${snapshot.highlight.title}`);
    console.log(`  ${snapshot.highlight.detailLine}`);
    console.log(`  ${snapshot.highlight.scoreLine}`);
  }

  console.log("\nFetching next Bangladesh fixtures from CricAPI…");
  const upcoming = await scrapeBangladeshUpcomingMatches();

  if (!upcoming?.matches.length) {
    console.log("No upcoming matches found. Existing cache kept (if any).");
  } else {
    console.log(`Saved to ${BANGLADESH_UPCOMING_MATCHES_PATH}`);
    for (const m of upcoming.matches) {
      console.log(`  ${formatUpcomingMatchMarqueeLine(m)}`);
    }
  }

  if (!snapshot && !upcoming?.matches.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
