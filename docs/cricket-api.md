# Cricket Data API

Internal REST API for The Tigers' Den. Aggregates live scores, tours, and ICC rankings for **men's and women's** cricket.

**Architecture & jobs:** [architecture.md](./architecture.md) · [jobs.md](./jobs.md) (includes CI tests)

## Setup

Add to `.env.local`:

```env
# Required for /tours index (CricAPI series list)
CRICKET_DATA_API_KEY=your_key_from_cricketdata.org
# Optional — second and third cricketdata.org accounts (auto-rotated on quota)
CRICKET_DATA_API_KEY_FALLBACK=
CRICKET_DATA_API_KEY_FALLBACK_2=
```

Live scores, last match, upcoming fixtures, and scorecards use **ESPNcricinfo** (free, no API key).

| Key | Provider | Sign up |
|-----|----------|---------|
| `CRICKET_DATA_API_KEY` | [CricketData.org (CricAPI)](https://cricketdata.org/signup.aspx) | Free tier (~100 req/day) — **tours index only** |
| `CRICKET_DATA_API_KEY_FALLBACK` | Same provider, second account | Optional |
| `CRICKET_DATA_API_KEY_FALLBACK_2` | Same provider, third account | Optional |

ICC rankings do **not** need an API key. They are fetched from the same JSON feed as [icc-cricket.com/rankings](https://www.icc-cricket.com/rankings) and cached in `data/icc-rankings.json`.

### Tour pages — snapshots, not live API

CricAPI builds the **upcoming tours index** (`/tours`). Each **series detail page** (`/tours/[slug]`) is pre-built by the nightly cricket sync and served from cache:

| Data | Source during sync | Stored in | Read on page load |
|------|-------------------|-----------|-------------------|
| Fixtures & match results | ESPN season events (CricAPI fallback) | `cricket-snapshots` (`tour-detail:{slug}`) + `data/tour-details.json` | DB → JSON fallback |
| Squads | ESPN core API + story RSS | Tour snapshot + `data/espn-tour-squads.json` | Cached snapshot |
| Venue & city guides | Template lookup once per ground | `venue-guides` snapshot + `data/venue-guides.json` + tour snapshot | Tour snapshot only |
| Confirmed start times | Curated schedule | `data/espn-fixture-times.json` | Merged during sync only |

Tour pages **do not** call ESPN or CricAPI at request time. When a series ends and leaves the upcoming index, its `tour-detail:{slug}` snapshot is pruned from DB and `data/tour-details.json`.

Umbrella tours (e.g. “Australia tour of Bangladesh”) prefer ESPN season events during sync so played matches show results and venues, not “Match starts …” placeholders.

Manual tour snapshot rebuild (prefer `npm run sync:cricket` on deploy):

```bash
npm run rebuild:tour-details
```

### Tour squads (ESPNcricinfo only)

Squad lists on `/tours/[slug]` come from **ESPNcricinfo**, not CricAPI:

1. `core.espnuk.org` league rosters (when published)
2. Squad announcement stories via ESPN RSS
3. Cache in `data/espn-tour-squads.json`

Refresh manually or on nightly sync:

```bash
npm run scrape:espn-squads
```

### Venue & host city guides

Ground descriptions, city guides, and typical weather are resolved **once per venue** during sync and stored in:

- `data/venue-guides.json` (persistent volume on prod)
- Payload `cricket-snapshots` key `venue-guides`

Each tour snapshot also embeds its venue list so `/tours/[slug]` never regenerates copy at request time. Bangladesh grounds (Shere Bangla, Chattogram, Sylhet) ship in the repo seed file.

### Confirmed fixture times

Series not yet in CricAPI use `data/espn-fixture-times.json` for BDT-accurate start times (and optional venue names). Updated manually or during sync — not read live on tour pages.

### Nightly ICC rankings update

```bash
npm run scrape:icc-rankings
```

This writes `data/icc-rankings.json`. A GitHub Action (`.github/workflows/scrape-icc-rankings.yml`) runs the same command every night at **3:15 AM Bangladesh time** and commits changes.

The site reads the cache first; if the file is missing it fetches live once as a fallback.

### Bangladesh last match (Match Centre)

The home page and `/match-centre` show Bangladesh's **most recent match result** from ESPNcricinfo (with a cached snapshot in `data/bangladesh-last-match.json`).

```bash
npm run scrape:bangladesh-match
```

Runs nightly at **3:30 AM BDT** via `.github/workflows/scrape-bangladesh-match.yml` (no CricAPI key required).

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

Runs nightly at **3:45 AM BDT** via `.github/workflows/scrape-bangladesh-news.yml`.

### Nightly job schedule

All scheduled jobs (server cron, GitHub Actions, deploy bootstrap) are documented in **[jobs.md](./jobs.md)**.

Quick reference (Bangladesh time):

| Time (BDT) | Job |
|------------|-----|
| 3:00 AM | Cricket sync → DB snapshots + `data/tour-details.json`, `data/venue-guides.json`, squads, last/upcoming match |
| 3:15 AM | ICC rankings + WTC → `data/*.json` (GitHub Action) |
| 3:30 AM | Bangladesh last match → `data/*.json` (GitHub Action) |
| 3:45 AM | Bangladesh news → `data/*.json` (GitHub Action) |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cricket` | Full dashboard (all data) |
| GET | `/api/cricket/tours` | Future tours (`?bangladeshOnly=true` default) |
| GET | `/api/cricket/live` | Live Bangladesh match + ESPN scorecard |
| GET | `/api/cricket/rankings` | Men & women ICC rankings |
| GET | `/api/cricket/scorecard/:matchId` | Ball-by-ball scorecard (`espn-*` match ids) |

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
