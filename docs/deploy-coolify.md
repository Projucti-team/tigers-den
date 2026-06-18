# Deploy with Coolify (Hetzner / VPS pipeline)

Use this when Coolify builds from your Git repo on each push (no manual `git pull` on the server).

**Overview:** [README](../README.md) · **Architecture:** [architecture.md](./architecture.md) · **Jobs:** [jobs.md](./jobs.md)

## Coolify app settings

| Setting | Value |
|---------|--------|
| **Build pack** | Dockerfile |
| **Dockerfile location** | `Dockerfile` |
| **Port** | `3000` |
| **Health check** | `GET /` on port 3000 |

## Database (recommended: Postgres on the server)

Create a **PostgreSQL** resource in Coolify (same project/network as the app). Use the **internal** connection string in the app env as `POSTGRES_URL`.

| Why Postgres on-server | |
|------------------------|--|
| Faster than remote Neon (no cross-cloud latency) | |
| No Neon quota / billing | |
| Cricket sync + CMS in one DB; chat is separate (Firestore) | |
| Player registry, snapshots, CMS in one DB | |

**Do not** set `DATABASE_URI=file:...` when `POSTGRES_URL` is set.

Migrating from Neon: [migrate-neon-to-server-postgres.md](./migrate-neon-to-server-postgres.md)

### SQLite (legacy / minimal)

Only if you intentionally skip Postgres: `DATABASE_URI=file:/app/data/tigersden.db` and no `POSTGRES_URL`. Not recommended for production (chat + sync contention).

## Persistent storage (required)

Mount volumes so JSON caches and uploads survive redeploys:

| Container path | Purpose |
|----------------|---------|
| `/app/data` | `data/*.json` cricket scrape caches (not the CMS DB when using Postgres) |
| `/app/media` | CMS uploads (hero images, etc.) |

In Coolify: **Storages** → add two volumes bound to those paths.

## Environment variables

Set these in Coolify → **Environment Variables** (production):

| Variable | Required | Notes |
|----------|----------|--------|
| `PAYLOAD_SECRET` | Yes | `openssl rand -base64 32` — keep the same value across DB migration |
| `NEXT_PUBLIC_SITE_URL` | Yes | `https://your-domain.com` |
| `NEXT_PUBLIC_SERVER_URL` | Yes | Same as site URL |
| `POSTGRES_URL` | Yes (prod) | Internal Coolify Postgres URL |
| `CRICKET_DATA_API_KEY` | Yes for `/tours` | [cricketdata.org](https://cricketdata.org/signup.aspx) |
| `CRICKET_DATA_API_KEY_FALLBACK` | No | Second account — auto-rotated when primary quota is hit |
| `CRICKET_DATA_API_KEY_FALLBACK_2` | No | Third account — rotated after the second key is exhausted |
| `CRON_SECRET` | Yes | `openssl rand -base64 32` — protects bootstrap + cron |
| `CRICKET_SYNC_ON_START` | No | Default `1` — idempotent sync after deploy when stale |
| `AUTH_SECRET` | If using member login | `openssl rand -base64 32` |
| `NEXT_PUBLIC_FIREBASE_*` + `FIREBASE_*` | For live chat | [firebase-chat.md](./firebase-chat.md) |

Chat uses Firestore (not Postgres) for real-time messages.

### Schema migrations

Postgres migrations run automatically on app boot via `getPayloadClient()` → `ensurePayloadSchema()`.

To apply manually after deploy:

```bash
curl -fsS -X POST "https://your-domain.com/api/admin/bootstrap-db" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Backups

Schedule daily `scripts/backup-postgres.sh` on the server (see migration doc). Keep `/app/media` volume backups too.

## What runs automatically on each deploy

1. **Coolify pipeline** builds the Docker image (`npm run build` — uses committed `app/(payload)/admin/importMap.js`).
2. **Container starts** → `deploy/docker-entrypoint.sh`:
   - Seeds `data/*.json` into the volume if missing.
   - Calls `POST /api/admin/bootstrap-db` when `CRON_SECRET` is set.
3. **Admin button** → cricket sync while logged in.

## Nightly full refresh (Coolify)

Add a **Scheduled Task** in Coolify (or server cron). Full schedule and troubleshooting: [jobs.md](./jobs.md).

```bash
curl -fsS -X POST "https://your-domain.com/api/cron/cricket" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Cron (UTC): `0 21 * * *` (= 3:00 AM BDT).

## After pushing to `main`

Coolify redeploys automatically. Check **Deployment logs** for:

```text
[entrypoint] cricket bootstrap/sync finished
```

Then open `/tours`, `/rankings`, and Payload admin.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Tours empty after deploy | `CRICKET_DATA_API_KEY` + `CRON_SECRET`; run cron sync with `?force=1` |
| CricAPI quota / rate limit | Add `CRICKET_DATA_API_KEY_FALLBACK` and/or `_FALLBACK_2` (separate cricketdata.org accounts); redeploy |
| Still hitting Neon / wrong DB | Only `POSTGRES_URL` set — remove `DATABASE_URI=file:...` |
| Missing tables | `POST /api/admin/bootstrap-db` with `CRON_SECRET` |
| Admin sync **Unauthorized** | Log in at `/admin` first |
| Force full sync | `CRICKET_SYNC_ON_START=force` for one deploy |
| Hero images broken | `NEXT_PUBLIC_SERVER_URL` = public HTTPS URL; persist `/app/media` |

See also [deploy-production.md](./deploy-production.md), [migrate-neon-to-server-postgres.md](./migrate-neon-to-server-postgres.md).
