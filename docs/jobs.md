# Background jobs & scripts

Scheduled tasks, deploy hooks, and manual commands that keep cricket data, rankings, and chat fresh.

All **Bangladesh times** below assume **UTC+6** (no DST). Cron expressions use **UTC**.

---

## Nightly schedule (Bangladesh time)

| Time (BDT) | Time (UTC) | Job | Runner |
|------------|------------|-----|--------|
| **3:00 AM** | 21:00 | **Cricket sync** — tours index, tour detail snapshots, venue guides, ESPN squads/fixtures, ICC → DB + JSON | Server: `POST /api/cron/cricket` |
| **3:15 AM** | 21:15 | **ICC rankings + WTC** → `data/icc-rankings.json`, `data/wtc-standings.json` | GitHub Action `scrape-icc-rankings` |
| **3:30 AM** | 21:30 | **Bangladesh last match** → `data/bangladesh-last-match.json` | GitHub Action `scrape-bangladesh-match` |
| **3:45 AM** | 21:45 | **Bangladesh cricket news** → `data/bangladesh-cricket-news.json` | GitHub Action `scrape-bangladesh-news` |

The server cricket sync also refreshes ICC/WTC JSON and runs ESPN squad scrape **inside the app** when the nightly cron fires — GitHub Actions keep the repo caches updated for dev and as a backup between deploys.

---

## 1. Server cron — cricket sync

**Endpoint:** `POST` or `GET` `/api/cron/cricket`  
**Auth:** `Authorization: Bearer YOUR_CRON_SECRET` (or `?secret=` in dev only)  
**Duration:** up to 5 minutes on the server (`maxDuration = 300`). The HTTP response returns **immediately** (HTTP 202) so Cloudflare does not time out with **524** — poll `GET ?status=1` until `inProgress` is false.

### What it does

`lib/cricket/services/sync-cricket-snapshots.ts`:

1. Refresh ICC rankings (Sportz) + WTC (ESPN) → JSON files + DB showcase.
2. Unless CricAPI snapshot is fresh (&lt; ~24h) and not `force`:
   - Fetch upcoming tours from CricketData.org → `tours-index` snapshot.
   - Build per-tour detail pages (`buildTourDetailLive`) → `tour-detail:{slug}` in DB **and** `data/tour-details.json`.
3. For umbrella tours, fixtures/results/venues come from **ESPN season events** (CricAPI is fallback when ESPN has no data).
4. Venue & city copy is resolved once per ground → `venue-guides` snapshot + `data/venue-guides.json` (reused across series).
5. Refresh ESPN tour squads → `data/espn-tour-squads.json` + tour snapshots.
6. Scrape Bangladesh last/upcoming matches → JSON + DB.
7. Seed/repair player registry (`countries`, `players`).
8. Prune finished series from `tour-detail:*` snapshots and `data/tour-details.json`.

### Coolify scheduled task

```bash
curl -fsS -X POST "https://your-domain.com/api/cron/cricket" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Cron expression (UTC): `0 21 * * *`

### Force full CricAPI refresh

```bash
curl -fsS -X POST "https://your-domain.com/api/cron/cricket?force=1" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Poll until finished (avoids Cloudflare 524 timeout):
curl -fsS "https://your-domain.com/api/cron/cricket?status=1" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

On the VPS, prefer `./scripts/prod-cricket-sync.sh --force` (hits localhost inside Docker when available).

### Local / manual

```bash
# Dev server must be running; CRON_SECRET optional in NODE_ENV=development
npm run sync:cricket

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

| Script | Command | When to use |
|--------|---------|-------------|
| `scripts/sync-cricket-nightly.ts` | `npm run sync:cricket` | Local trigger of `/api/cron/cricket` |
| `scripts/prod-cricket-sync.sh` | `npm run sync:cricket:prod` | Hit production cron URL |
| `scripts/run-deploy-cricket-sync.ts` | `npm run deploy:cricket-sync` | Post-deploy sync helper |
| `scripts/scrape-icc-rankings.ts` | `npm run scrape:icc-rankings` | Refresh ICC JSON only |
| `scripts/scrape-wtc-standings.ts` | `npm run scrape:wtc-standings` | Refresh WTC JSON only |
| `scripts/scrape-bangladesh-match.ts` | `npm run scrape:bangladesh-match` | Last BD match JSON |
| `scripts/scrape-bangladesh-news.ts` | `npm run scrape:bangladesh-news` | News backup JSON |
| `scripts/scrape-espn-squads.ts` | `npm run scrape:espn-squads` | Tour squad cache |
| `scripts/rebuild-rankings-showcase.ts` | `npm run rebuild:rankings` | Rebuild rankings snapshot in DB |
| `scripts/rebuild-tour-details.ts` | `npm run rebuild:tour-details` | Rebuild tour detail JSON + DB (prefer `sync:cricket` on deploy) |
| `scripts/backup-postgres.sh` | (cron on server) | Daily DB backup |
| `scripts/hetzner-bootstrap.sh` | manual | VPS bootstrap + first sync |
| `deploy/docker-entrypoint.sh` | automatic on deploy | Volume seed + bootstrap |

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
