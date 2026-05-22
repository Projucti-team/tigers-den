# Cricket Data API

Internal REST API for The Tigers' Den. Aggregates live scores, tours, and ICC rankings for **men's and women's** cricket.

## Setup

Add to `.env.local`:

```env
# Required for tours, live scores, scorecards
CRICKET_DATA_API_KEY=your_key_from_cricketdata.org
```

| Key | Provider | Sign up |
|-----|----------|---------|
| `CRICKET_DATA_API_KEY` | [CricketData.org (CricAPI)](https://cricketdata.org/signup.aspx) | Free tier |

ICC rankings do **not** need an API key. They are fetched from the same JSON feed as [icc-cricket.com/rankings](https://www.icc-cricket.com/rankings) and cached in `data/icc-rankings.json`.

### Nightly ICC rankings update

```bash
npm run scrape:icc-rankings
```

This writes `data/icc-rankings.json`. A GitHub Action (`.github/workflows/scrape-icc-rankings.yml`) runs the same command every night at 02:00 UTC and commits changes.

The site reads the cache first; if the file is missing it fetches live once as a fallback.

### Bangladesh last match (Match Centre)

The home page and `/match-centre` always show Bangladesh's **most recent match result** from `data/bangladesh-last-match.json`. Live scores use one lightweight CricAPI call; the last result does not burn quota on every page load.

```bash
npm run scrape:bangladesh-match
```

Runs nightly via `.github/workflows/scrape-bangladesh-match.yml` (set `CRICKET_DATA_API_KEY` in GitHub secrets).

### Bangladesh cricket news feed (live, free tier)

The home page **Tigers in the headlines** section fetches live on each cache window (15 minutes):

| Source | Cost | Live requests per refresh |
|--------|------|---------------------------|
| ESPN Cricinfo RSS | Free | 1 |
| Cricbuzz (listing + up to 3 articles) | Free scrape | ~5 max |
| `data/bangladesh-cricket-news.json` | Backup | 0 (merged if present) |

No paid API key. Nightly scrape adds richer Cricbuzz articles without hitting sources on every page view:

```bash
npm run scrape:bangladesh-news
```

Runs nightly via `.github/workflows/scrape-bangladesh-news.yml`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cricket` | Full dashboard (all data) |
| GET | `/api/cricket/tours` | Future tours (`?bangladeshOnly=true` default) |
| GET | `/api/cricket/live` | Live matches + Bangladesh scorecard |
| GET | `/api/cricket/rankings` | Men & women ICC rankings |
| GET | `/api/cricket/scorecard/:matchId` | Ball-by-ball scorecard |

## Rankings response shape

For each **gender** (`men`, `women`) and **format** (`test`, `odi`, `t20`):

- `teams` — full ICC team ranking table
- `bangladesh` — Bangladesh's row (or `null`)
- `players.topBatsmen` — top 5 batters
- `players.topBowlers` — top 5 bowlers
- `players.topBangladeshBatsman` — highest-ranked Bangladesh batter
- `players.topBangladeshBowler` — highest-ranked Bangladesh bowler
- `players.topBangladeshAllRounder` — highest-ranked Bangladesh all-rounder

Women's rankings cover **ODI and T20I only** (Test is omitted).

## Example

```bash
curl http://localhost:3000/api/cricket/rankings
curl "http://localhost:3000/api/cricket/tours?bangladeshOnly=true"
curl http://localhost:3000/api/cricket/live
npm run scrape:icc-rankings
npm run scrape:bangladesh-match
npm run scrape:bangladesh-news
```

Responses include `meta.warnings` when a provider is missing or the cache is stale.
