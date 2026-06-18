# Migrate from Neon to Postgres on your server

Production should use **Postgres on the same VPS as the app** (Coolify database or Docker). Keep `data/*.json` on `/app/data` as scrape cache/seed — that is separate from Payload.

**Why:** lower latency than remote Neon, no Neon quota, better for chat + nightly cricket sync writing at the same time.

Local dev can stay on SQLite (`DATABASE_URI=file:./tigersden.db` in `.env.local`).

**Quick script** (after step 1 below):

```bash
export NEON_URL='postgresql://...'          # Neon dashboard → Connection string
export SERVER_POSTGRES_URL='postgresql://...'  # Coolify Postgres internal URL
./scripts/migrate-neon-to-server.sh
```

---

## Cutover checklist (tigersden.bd on Coolify)

Do these in order. Expect **5–15 minutes** downtime while you swap `POSTGRES_URL` and redeploy.

- [ ] **1.** Coolify → **+ New Resource** → **PostgreSQL 16** (same project/network as the app). Copy the **internal** URL.
- [ ] **2.** Neon dashboard → **Connection string** → copy `NEON_URL`.
- [ ] **3.** Run `./scripts/migrate-neon-to-server.sh` (from laptop if Neon is public; run restore on the server if DB is internal-only).
- [ ] **4.** Coolify → **app** → **Environment**:
  - Set `POSTGRES_URL` = internal Coolify Postgres URL
  - **Remove** `DATABASE_URI` if it is `file:...`
  - Keep `PAYLOAD_SECRET` **unchanged**
- [ ] **5.** Confirm volumes: `/app/data`, `/app/media` (uploads are not in Postgres).
- [ ] **6.** Add Firebase vars for live chat — [firebase-chat.md](./firebase-chat.md) (optional but recommended).
- [ ] **7.** **Redeploy** the app (or wait for auto-deploy after `git push`).
- [ ] **8.** Verify:

```bash
curl -fsS -X POST "https://tigersden.bd/api/admin/bootstrap-db" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

curl -fsS -X POST "https://tigersden.bd/api/cron/cricket?force=1" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

- [ ] **9.** Open `/admin`, `/tours`, `/rankings`, `/match-centre` (chat).
- [ ] **10.** After 24–48h stable: final Neon dump, pause/delete Neon project.

---

## 1. Create Postgres on Coolify

1. Coolify → **+ New Resource** → **Database** → **PostgreSQL** (version 16+).
2. Note the **internal** connection URL (hostname is usually the service name on the Docker network, e.g. `postgresql://user:pass@postgres-xxx:5432/tigersden`).
3. Do **not** expose Postgres to the public internet unless you firewall it.

If you use plain Docker Compose instead, see `docker-compose.postgres.yml` in the repo root.

---

## 2. Export from Neon

From your laptop (Neon dashboard → Connection string, or existing `POSTGRES_URL`):

```bash
export NEON_URL='postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require'

pg_dump "$NEON_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file=tigersden-neon.dump
```

Plain SQL also works:

```bash
pg_dump "$NEON_URL" --no-owner --no-acl > tigersden-neon.sql
```

---

## 3. Import into server Postgres

Copy the dump to the server, then restore into the **empty** Coolify database:

```bash
# Custom format
pg_restore --no-owner --no-acl --dbname="$SERVER_POSTGRES_URL" tigersden-neon.dump

# Or plain SQL
psql "$SERVER_POSTGRES_URL" < tigersden-neon.sql
```

`SERVER_POSTGRES_URL` is the Coolify Postgres URL. Run restore from a machine that can reach the DB (Coolify server SSH, or Coolify “Terminal” on the DB container).

---

## 4. Point the app at server Postgres

In Coolify → **your app** → **Environment Variables**:

| Set | Value |
|-----|--------|
| `POSTGRES_URL` | `postgresql://user:pass@postgres-service:5432/tigersden` (internal URL) |

| Remove or unset | |
|-----------------|--|
| `DATABASE_URI` | Must **not** be `file:...` in production when using Postgres |
| Old Neon `POSTGRES_URL` | Replace with server URL |

Keep unchanged:

- `PAYLOAD_SECRET` — **same value** as before (or sessions/admin break)
- `CRON_SECRET`, `CRICKET_DATA_API_KEY`, `NEXT_PUBLIC_*`, auth vars
- Volume mounts: `/app/data` (JSON caches), `/app/media` (uploads)

Redeploy the app. On boot, `deploy/docker-entrypoint.sh` calls bootstrap → Payload runs Postgres migrations for any new tables (e.g. `players`, `countries`).

Verify:

```bash
curl -fsS -X POST "https://your-domain.com/api/admin/bootstrap-db" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Open `/admin`, `/tours`, `/rankings`, Match Centre chat.

---

## 5. Backups (you own these now)

Daily on the server (cron or Coolify scheduled task):

```bash
# From repo scripts/backup-postgres.sh — set POSTGRES_URL first
./scripts/backup-postgres.sh
```

Store dumps off-server (Hetzner Object Storage, another VPS, etc.). Keep at least 7 days.

---

## 6. Cut over Neon

1. Confirm prod works on server Postgres for 24–48 hours.
2. Take a final Neon dump for archive.
3. Delete or pause the Neon project to stop billing.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| App still uses SQLite | `POSTGRES_URL` missing or `DATABASE_URI=file:...` still set — remove SQLite URI |
| `relation does not exist` | Run bootstrap: `POST /api/admin/bootstrap-db` with `CRON_SECRET` |
| Restore fails on extensions | Neon may use extensions; create them in server DB first or use `--no-owner` restore |
| Media/images 404 | Uploads live in `/app/media` volume, not in Postgres — keep that volume mounted |
| Cricket data empty | Run `POST /api/cron/cricket?force=1` once after cutover |

---

## Architecture after migration

```
Coolify VPS
├── App (Next.js + Payload)  ──POSTGRES_URL──►  Postgres (same host)
├── Volume /app/data         →  data/*.json caches (not the CMS DB)
└── Volume /app/media        →  CMS uploads
```

No code changes required — the app already uses `@payloadcms/db-postgres` when `POSTGRES_URL` is set.
