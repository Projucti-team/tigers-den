# Deploy with Coolify (Hetzner / VPS pipeline)

Use this when Coolify builds from your Git repo on each push (no manual `git pull` on the server).

## Coolify app settings

| Setting | Value |
|---------|--------|
| **Build pack** | Dockerfile |
| **Dockerfile location** | `Dockerfile` |
| **Port** | `3000` |
| **Health check** | `GET /` on port 3000 |

## Persistent storage (required)

Mount volumes so the SQLite DB and uploads survive redeploys:

| Container path | Purpose |
|----------------|---------|
| `/app/data` | SQLite DB (`tigersden.db`) + `data/*.json` cricket caches |
| `/app/media` | CMS uploads (hero images, etc.) |

In Coolify: **Storages** → add two volumes bound to those paths.

Without `/app/data`, every deploy wipes tours and admin content.

## Environment variables

Set these in Coolify → **Environment Variables** (production):

| Variable | Required | Notes |
|----------|----------|--------|
| `PAYLOAD_SECRET` | Yes | `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_URL` | Yes | `https://your-domain.com` |
| `NEXT_PUBLIC_SERVER_URL` | Yes | Same as site URL |
| `DATABASE_URI` | Yes | `file:/app/data/tigersden.db` |
| `CRICKET_DATA_API_KEY` | Yes for `/tours` | [cricketdata.org](https://cricketdata.org/signup.aspx) |
| `CRON_SECRET` | Yes | `openssl rand -base64 32` — protects bootstrap + cron |
| `CRICKET_SYNC_ON_START` | No | Default `1` — runs idempotent sync after each deploy when tours are missing/stale |
| `AUTH_SECRET` | If using member login | `openssl rand -base64 32` |

Do **not** set `POSTGRES_URL` unless you intentionally use Neon/Postgres instead of SQLite.

### Database schema (tours, stand, match chat)

Coolify uses **SQLite** on `/app/data` — do **not** run `npm run deploy:migrate` inside the production container (`tsx` is not installed there).

Schema updates run automatically when the app boots:

1. **Container entrypoint** → `POST /api/admin/bootstrap-db` (when `CRON_SECRET` + `CRICKET_DATA_API_KEY` are set).
2. **First chat load** → creates `match_chat_*` tables if missing.

To apply schema manually after a deploy:

```bash
curl -fsS -X POST "https://your-domain.com/api/admin/bootstrap-db" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

If admin sync still errors about a missing table, add temporarily `PAYLOAD_SQLITE_PUSH_SCHEMA=1`, redeploy once, then remove it.

## What runs automatically on each deploy

1. **Coolify pipeline** builds the Docker image (`npm run build` — uses committed `app/(payload)/admin/importMap.js`).
2. **Container starts** → `deploy/docker-entrypoint.sh`:
   - Seeds `data/*.json` into the volume if missing.
   - Calls `POST /api/admin/bootstrap-db` when `CRICKET_DATA_API_KEY` + `CRON_SECRET` are set (skips if tours already synced).
3. **Admin button** → `POST /api/cricket-snapshots/sync` (manual full refresh while logged in).

Build time does **not** run tours sync — the database only exists on the persistent volume at runtime.

## Nightly full refresh (Coolify)

Add a **Scheduled Task** in Coolify (or server cron) hitting your public URL:

```bash
curl -fsS -X POST "https://your-domain.com/api/cron/cricket" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Schedule: `0 21 * * *` (21:00 UTC ≈ 3:00 AM Bangladesh). GitHub Actions for JSON caches run at 3:15–3:45 AM BDT — see `docs/cricket-api.md`.

## After pushing to `main`

Coolify redeploys automatically. Check **Deployment logs** for:

```text
[entrypoint] cricket bootstrap/sync finished
```

Then open `/tours` and Payload admin → Cricket Snapshots → confirm rows exist.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Tours empty after deploy | Confirm `/app/data` volume + `CRICKET_DATA_API_KEY` + `CRON_SECRET` in Coolify env |
| Admin sync **Unauthorized** | Log out/in at `/admin`; use latest image with `/api/cricket-snapshots/sync` |
| Sync runs every deploy but you want to skip | Set `CRICKET_SYNC_ON_START=0` |
| Force full sync after deploy | Set `CRICKET_SYNC_ON_START=force` for one deploy, then back to `1` |
| Hero images broken | `NEXT_PUBLIC_SERVER_URL` must match your public HTTPS URL; persist `/app/media` |

See also [deploy-production.md](./deploy-production.md) for generic Docker details.
