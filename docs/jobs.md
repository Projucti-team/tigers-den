# Background jobs & scripts

Scheduled tasks, deploy hooks, and manual commands that keep cricket data, rankings, and chat fresh.

All **Bangladesh times** below assume **UTC+6** (no DST). Cron expressions use **UTC**.

---

## Nightly schedule (Bangladesh time)

| Time (BDT) | Time (UTC) | Job | Source |
|------------|------------|-----|--------|
| **3:00 AM** | 21:00 | **Tours index + state** — CricAPI tours → DB, initialize `tour_sync_state` | Server: `POST /api/cron/cricket?jobs=tours` |
| **3:15 AM** | 21:15 | **Squad refresh** — ESPN squads for active tours, upcoming formats only | Server: `POST /api/cron/cricket?jobs=squads` |
| **3:30 AM** | 21:30 | **Rankings** — ICC + WTC → JSON + DB showcase | Server: `POST /api/cron/cricket?jobs=rankings` |
| **3:45 AM** | 21:45 | **Bangladesh live** — Last/upcoming BD matches → JSON + DB | Server: `POST /api/cron/cricket?jobs=last-match,upcoming` |
| **12:00 PM** | 06:00 | **Squad refresh** (repeat) — ESPN squads for active tours | Server: `POST /api/cron/cricket?jobs=squads` |
| **6:00 PM** | 12:00 | **Squad refresh** (repeat) — ESPN squads for active tours | Server: `POST /api/cron/cricket?jobs=squads` |

GitHub Actions keep repo caches updated for dev and as backup between deploys (jobs.md docs: old schedule — may be deprecated).

---

## 1. Server cron — cricket sync

**Endpoint:** `POST` or `GET` `/api/cron/cricket`  
**Auth:** `Authorization: Bearer YOUR_CRON_SECRET` (or `?secret=` in dev only)  
**Duration:** up to 5 minutes on the server (`maxDuration = 300`). The HTTP response returns **immediately** (HTTP 202) so Cloudflare does not time out with **524** — poll `GET ?status=1` until `inProgress` is false.

### Modular job architecture

The sync is now split into **independent jobs** that can run on different schedules. Select jobs via `?jobs=` parameter (comma-separated).

#### Tours index job (`?jobs=tours`)

`lib/cricket/services/sync-cricket-snapshots.ts::syncToursIndex()`:

1. Fetch upcoming tours from CricAPI (unless snapshot is fresh &lt; 24h)
2. Build per-tour detail pages → `tour-detail:{slug}` DB snapshots + `data/tour-details.json`
3. Initialize/update `tour_sync_state` table (tracks active tours, series format status)
4. Mark finished tours as done (no squad refresh wasted)
5. For umbrella tours: fixtures/results from ESPN (CricAPI fallback if missing)
6. Resolve venues once per ground → `venue-guides` snapshot + JSON
7. Prune old tour snapshots

#### Squad refresh job (`?jobs=squads`)

`lib/cricket/services/sync-cricket-snapshots.ts::syncSquads()`:

1. Query `tour_sync_state` for active tours with **upcoming** formats (Test/ODI/T20)
2. Skip tours where squads already imported for that format
3. Fetch squads from **ESPN only** (lightweight, no CricAPI quota)
4. Merge squads into existing tour-detail snapshots
5. Mark format complete, update last-sync timestamp

**Key feature:** Lightweight, selective. Can run 2–3× daily without quota pressure. Only fetches for:
- Active tours (matches in next 30 days)
- Upcoming formats (not past, not finished)
- Not yet imported (first time per format)

#### Rankings job (`?jobs=rankings` or `?jobs=icc,wtc`)

`lib/cricket/services/sync-cricket-snapshots.ts::syncRankings()`:

1. Refresh ICC rankings (Sportz) → `data/icc-rankings.json`
2. Refresh WTC standings (ESPN) → `data/wtc-standings.json`
3. Build rankings showcase → DB + JSON

#### Bangladesh live job (`?jobs=last-match,upcoming`)

`lib/cricket/services/sync-cricket-snapshots.ts::syncBangladeshLive()`:

1. Scrape last completed Bangladesh match → `bangladesh-last-match.json`
2. Scrape upcoming Bangladesh fixtures → `bangladesh-upcoming-matches.json`

#### Player registry job (`?jobs=players`)

`lib/cricket/services/sync-cricket-snapshots.ts::syncCricketSnapshots()`:

1. Seed country data in `countries` table
2. Repair broken player profile/headshot URLs in `players` table

### Coolify scheduled tasks

Set up separate Coolify tasks for each job on its own schedule:

**3:00 AM BDT (21:00 UTC) — Tours index:**
```bash
curl -fsS -X POST "https://your-domain.com/api/cron/cricket?jobs=tours" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
Cron: `0 21 * * *`

**3:15 AM BDT (21:15 UTC) — Squad refresh:**
```bash
curl -fsS -X POST "https://your-domain.com/api/cron/cricket?jobs=squads" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
Cron: `15 21 * * *`

**12:00 PM BDT (06:00 UTC) — Squad refresh (repeat):**
```bash
curl -fsS -X POST "https://your-domain.com/api/cron/cricket?jobs=squads" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
Cron: `0 6 * * *`

**6:00 PM BDT (12:00 UTC) — Squad refresh (repeat):**
```bash
curl -fsS -X POST "https://your-domain.com/api/cron/cricket?jobs=squads" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
Cron: `0 12 * * *`

**3:30 AM BDT (21:30 UTC) — Rankings:**
```bash
curl -fsS -X POST "https://your-domain.com/api/cron/cricket?jobs=rankings" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
Cron: `30 21 * * *`

**3:45 AM BDT (21:45 UTC) — Bangladesh live:**
```bash
curl -fsS -X POST "https://your-domain.com/api/cron/cricket?jobs=last-match,upcoming" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
Cron: `45 21 * * *`

### Query parameters

- `?jobs=tours` — Tours index only
- `?jobs=squads` — Squad refresh only
- `?jobs=rankings` — Rankings (ICC + WTC) only
- `?jobs=last-match,upcoming` — Bangladesh matches only
- `?jobs=tours,squads` — Multiple jobs (comma-separated)
- `?force=1` — Force full CricAPI refresh on tours job (ignore 24h freshness check)
- `?wait=1` — Wait synchronously (default: background 202 response + poll `?status=1`)
- `?status=1` — Check sync progress (returns `{inProgress: bool, ...}`)

### Force full CricAPI refresh

```bash
# Bypass freshness check, re-fetch tours from CricAPI
curl -fsS -X POST "https://your-domain.com/api/cron/cricket?jobs=tours&force=1&wait=1" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Or poll asynchronously (returns 202 immediately):
curl -fsS -X POST "https://your-domain.com/api/cron/cricket?jobs=tours&force=1" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Poll until finished:
curl -fsS "https://your-domain.com/api/cron/cricket?status=1" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

On the VPS, prefer `./scripts/prod-cricket-sync.sh --force` (hits localhost inside Docker).

### Local / manual

```bash
# Dev server must be running; CRON_SECRET optional in NODE_ENV=development

# Run all jobs (full sync)
npm run sync:cricket

# Run specific job(s)
npm run sync:cricket -- --jobs=squads

# Against production URL (reads .env.production)
npm run sync:cricket:prod
```

---

## 2. Deploy bootstrap

**Endpoint:** `POST /api/admin/bootstrap-db`  
**Auth:** same `CRON_SECRET`  
**Triggered by:** `deploy/docker-entrypoint.sh` on container start (background)

### What it does

- Runs Payload Postgres migrations (`ensurePayloadSchema`).
- If cricket snapshots are missing or stale, runs the same sync as the nightly job.
- Controlled by `CRICKET_SYNC_ON_START`:
  - `1` (default) — sync when stale
  - `0` / `false` — skip
  - `force` — always full sync (`?forceCricketSync=1`)

Manual run after deploy or DB migration:

```bash
curl -fsS -X POST "https://your-domain.com/api/admin/bootstrap-db" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 3. GitHub Actions

Workflows in `.github/workflows/` commit updated JSON to `data/` on schedule. Useful for local dev and redundancy; production reads from the **server volume** (seeded from image + nightly sync).

### JSON written by server cricket sync (3:00 AM BDT)

These are updated by `POST /api/cron/cricket`, not GitHub Actions:

| File | Snapshot key | Contents |
|------|--------------|----------|
| `data/tour-details.json` | `tour-detail:{slug}` | Per-series fixtures, results, squads, venues |
| `data/venue-guides.json` | `venue-guides` | Ground & host city copy (once per venue) |
| `data/espn-tour-squads.json` | (merged into tour snapshots) | ESPN squad cache |
| `data/bangladesh-last-match.json` | `bangladesh-last-match` | Last completed BD match |
| `data/bangladesh-upcoming-matches.json` | `bangladesh-upcoming-matches` | Upcoming marquee fixtures |

### JSON written by GitHub Actions

| Workflow | Schedule (UTC) | npm command | Output files |
|----------|----------------|-------------|--------------|
| `scrape-icc-rankings.yml` | `15 21 * * *` | `scrape:icc-rankings` + `scrape:wtc-standings` | `icc-rankings.json`, `wtc-standings.json` |
| `scrape-bangladesh-match.yml` | `30 21 * * *` | `scrape:bangladesh-match` | `bangladesh-last-match.json` |
| `scrape-bangladesh-news.yml` | `45 21 * * *` | `scrape:bangladesh-news` | `bangladesh-cricket-news.json` |

**Secret required:** `CRICKET_DATA_API_KEY` in GitHub repo secrets (for bangladesh-match workflow).

All workflows support **workflow_dispatch** (manual run from Actions tab).

---

## 4. Postgres backups

**Script:** `scripts/backup-postgres.sh`  
**Schedule:** daily on the server (cron or Coolify scheduled task)

Backs up the Coolify Postgres database to a local path. See [migrate-neon-to-server-postgres.md](./migrate-neon-to-server-postgres.md).

---

## 5. Admin UI cricket sync

Logged-in Payload admins can trigger sync from the admin panel (uses `/api/admin/cricket-sync`) without waiting for cron — same underlying `syncCricketSnapshots` logic.

---

## Script reference

### Main sync entry point (use `--jobs` for selective runs)

| Command | Purpose |
|---------|---------|
| `npm run sync:cricket` | Trigger all jobs against localhost dev server |
| `npm run sync:cricket -- --jobs=squads` | Trigger squad refresh only |
| `npm run sync:cricket -- --jobs=tours` | Trigger tours index only |
| `npm run sync:cricket:prod` | Hit production cron URL with all jobs |
| `npm run sync:cricket:prod -- --jobs=squads` | Hit production cron with squad refresh only |

### Standalone scripts (for specific use cases)

| Script | Command | When to use |
|--------|---------|-------------|
| `scripts/sync-cricket-nightly.ts` | `npm run sync:cricket` | Local dev trigger |
| `scripts/prod-cricket-sync.sh` | `npm run sync:cricket:prod` | Production cron URL (shell wrapper) |
| `scripts/run-deploy-cricket-sync.ts` | `npm run deploy:cricket-sync` | Post-deploy bootstrap |
| `scripts/scrape-icc-rankings.ts` | `npm run scrape:icc-rankings` | Backup ICC JSON (alternative to job) |
| `scripts/scrape-wtc-standings.ts` | `npm run scrape:wtc-standings` | Backup WTC JSON (alternative to job) |
| `scripts/scrape-bangladesh-match.ts` | `npm run scrape:bangladesh-match` | Backup BD last match (alternative to job) |
| `scripts/backup-postgres.sh` | (cron on server) | Daily DB backup |
| `scripts/hetzner-bootstrap.sh` | manual | VPS bootstrap + first full sync |
| `deploy/docker-entrypoint.sh` | automatic on deploy | Volume seed + bootstrap on container start |

---

## Environment variables for jobs

| Variable | Used by |
|----------|---------|
| `CRON_SECRET` | `/api/cron/cricket`, `/api/admin/bootstrap-db`, entrypoint |
| `CRICKET_DATA_API_KEY` | CricAPI upcoming tours index (tour detail fixtures come from ESPN during sync) |
| `CRICKET_DATA_API_KEY_FALLBACK` | Second CricAPI account when primary quota hit |
| `CRICKET_DATA_API_KEY_FALLBACK_2` | Third CricAPI account when both prior keys are exhausted |
| `CRICKET_SYNC_ON_START` | Docker entrypoint (`1`, `0`, `force`) |
| `POSTGRES_URL` | Snapshot persistence (required in prod) |
| `PAYLOAD_SECRET` | Payload DB access during sync |

---

## Tests (CI + local)

GitHub Actions workflow `.github/workflows/ci.yml` runs on every push/PR:

| Job | Command | What it guards |
|-----|---------|----------------|
| Unit | `npm run test:unit` | Tour team labels, match status formatting, snapshot audit rules, no live ESPN reads on tour pages |
| E2E | `npm run test:e2e` | `/tours/[slug]` renders match results, venue guides, and host cities from cached JSON |

Canonical fixture data lives in `data-seed/tour-details.json`. The nightly sync writes job output to `data/tour-details.json`; unit tests audit that file for series ID mismatches and stale “Match starts” copy on past games.

Local:

```bash
npm run test:unit
npm run test:e2e   # builds app + starts test server (needs Playwright browser once: npx playwright install chromium)
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Empty `/tours` or `/rankings` | Set `CRICKET_DATA_API_KEY` + `CRON_SECRET`; run cron with `?force=1` |
| `401` on cron | Check `Authorization: Bearer` matches `CRON_SECRET` in Coolify |
| CricAPI quota exhausted | Add `CRICKET_DATA_API_KEY_FALLBACK` / `_FALLBACK_2`; wait for 24h guard or use `force` |
| Stale tour fixtures / missing results on `/tours/[slug]` | Run cricket sync with `?force=1` — tour pages read from `tour-detail:{slug}` snapshot, not live ESPN |
| Venue section empty on tour page | Sync must have run after venues were confirmed; check `data/venue-guides.json` and tour snapshot |
| Stale ICC dates on rankings | Run sync — showcase uses per-table `rankUpdatedAt` (snapshot v4+) |
| JSON caches old on prod | Nightly sync writes to `/app/data`; check volume mount |
| `relation does not exist` | `POST /api/admin/bootstrap-db` with `CRON_SECRET` |
| Chat not real-time | Firebase env + [firebase-chat.md](./firebase-chat.md) |
