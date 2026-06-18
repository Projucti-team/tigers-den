# Background jobs & scripts

Scheduled tasks, deploy hooks, and manual commands that keep cricket data, rankings, and chat fresh.

All **Bangladesh times** below assume **UTC+6** (no DST). Cron expressions use **UTC**.

---

## Nightly schedule (Bangladesh time)

| Time (BDT) | Time (UTC) | Job | Runner |
|------------|------------|-----|--------|
| **3:00 AM** | 21:00 | **Cricket sync** — CricAPI tours/fixtures, ESPN squads, ICC → DB snapshots, player registry | Server: `POST /api/cron/cricket` |
| **3:15 AM** | 21:15 | **ICC rankings + WTC** → `data/icc-rankings.json`, `data/wtc-standings.json` | GitHub Action `scrape-icc-rankings` |
| **3:30 AM** | 21:30 | **Bangladesh last match** → `data/bangladesh-last-match.json` | GitHub Action `scrape-bangladesh-match` |
| **3:45 AM** | 21:45 | **Bangladesh cricket news** → `data/bangladesh-cricket-news.json` | GitHub Action `scrape-bangladesh-news` |

The server cricket sync also refreshes ICC/WTC JSON and runs ESPN squad scrape **inside the app** when the nightly cron fires — GitHub Actions keep the repo caches updated for dev and as a backup between deploys.

---

## 1. Server cron — cricket sync

**Endpoint:** `POST` or `GET` `/api/cron/cricket`  
**Auth:** `Authorization: Bearer YOUR_CRON_SECRET` (or `?secret=` in dev only)  
**Duration:** up to 5 minutes (`maxDuration = 300`)

### What it does

`lib/cricket/services/sync-cricket-snapshots.ts`:

1. Refresh ICC rankings (Sportz) + WTC (ESPN) → JSON files + DB showcase.
2. Unless CricAPI snapshot is fresh (&lt; ~24h) and not `force`:
   - Fetch tours, fixtures, matches from CricketData.org.
   - Build per-tour detail snapshots → `cricket-snapshots` in Postgres.
3. Merge ESPN confirmed schedules when CricAPI is missing or rate-limited.
4. Refresh ESPN tour squads → `data/espn-tour-squads.json` + tour snapshots.
5. Scrape Bangladesh last/upcoming matches → JSON.
6. Seed/repair player registry (`countries`, `players`).

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
```

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
| `scripts/backup-postgres.sh` | (cron on server) | Daily DB backup |
| `scripts/hetzner-bootstrap.sh` | manual | VPS bootstrap + first sync |
| `deploy/docker-entrypoint.sh` | automatic on deploy | Volume seed + bootstrap |

---

## Environment variables for jobs

| Variable | Used by |
|----------|---------|
| `CRON_SECRET` | `/api/cron/cricket`, `/api/admin/bootstrap-db`, entrypoint |
| `CRICKET_DATA_API_KEY` | CricAPI tours, live, bangladesh-match scrape |
| `CRICKET_DATA_API_KEY_FALLBACK` | Second CricAPI account when primary quota hit |
| `CRICKET_SYNC_ON_START` | Docker entrypoint (`1`, `0`, `force`) |
| `POSTGRES_URL` | Snapshot persistence (required in prod) |
| `PAYLOAD_SECRET` | Payload DB access during sync |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Empty `/tours` or `/rankings` | Set `CRICKET_DATA_API_KEY` + `CRON_SECRET`; run cron with `?force=1` |
| `401` on cron | Check `Authorization: Bearer` matches `CRON_SECRET` in Coolify |
| CricAPI quota exhausted | Add `CRICKET_DATA_API_KEY_FALLBACK`; wait for 24h guard or use `force` |
| Stale ICC dates on rankings | Run sync — showcase uses per-table `rankUpdatedAt` (snapshot v4+) |
| JSON caches old on prod | Nightly sync writes to `/app/data`; check volume mount |
| `relation does not exist` | `POST /api/admin/bootstrap-db` with `CRON_SECRET` |
| Chat not real-time | Firebase env + [firebase-chat.md](./firebase-chat.md) |
