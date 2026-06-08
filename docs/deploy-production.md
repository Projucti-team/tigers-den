# Deploy The Tigers' Den to production

Single-server deployment with **Docker** (recommended). No paid hosting required beyond a small VPS (~$5–12/mo).

**Using Coolify on Hetzner with a Git deploy pipeline?** → [deploy-coolify.md](./deploy-coolify.md)

## What you need

| Item | Notes |
|------|--------|
| **VPS** | Ubuntu 22/24, 1 GB RAM+, 1 vCPU (Hetzner, DigitalOcean, Linode, etc.) |
| **Domain** | Optional but recommended for HTTPS |
| **Secrets** | `PAYLOAD_SECRET`, optional `CRICKET_DATA_API_KEY` |

Cricket news and ICC rankings use **free** RSS/scrape sources. CricAPI is optional (free tier ~100 req/day).

## 1. Push code to GitHub

```bash
cd /path/to/tigersden
git init
git add .
git commit -m "Initial production deploy"
git remote add origin git@github.com:YOUR_ORG/tigersden.git
git push -u origin main
```

## 2. Prepare the server

SSH in as root or a sudo user:

```bash
ssh user@YOUR_SERVER_IP
```

Clone the repo:

```bash
sudo mkdir -p /var/www/tigersden
sudo chown $USER:$USER /var/www/tigersden
git clone git@github.com:YOUR_ORG/tigersden.git /var/www/tigersden
cd /var/www/tigersden
```

## 3. Environment file

```bash
cp .env.production.example .env.production
nano .env.production
```

Set at minimum:

```env
PAYLOAD_SECRET=<run: openssl rand -base64 32>
NEXT_PUBLIC_SITE_URL=https://tigersden.yourdomain.com
NEXT_PUBLIC_SERVER_URL=https://tigersden.yourdomain.com
DATABASE_URI=file:/app/data/tigersden.db
CRICKET_DATA_API_KEY=your_cricapi_key_if_you_have_one
CRON_SECRET=<run: openssl rand -base64 32>
CRICKET_SYNC_ON_START=1
```

`CRICKET_DATA_API_KEY` is **required** for upcoming tours on `/tours` (stored in the CMS SQLite DB). `CRON_SECRET` secures the nightly sync endpoint.

## 4. Start with Docker

```bash
chmod +x scripts/prod-setup.sh
./scripts/prod-setup.sh
```

Or manually:

```bash
docker compose build
docker compose up -d
docker compose logs -f app
```

Open `http://SERVER_IP:3000` — you should see the fan site.  
Admin: `http://SERVER_IP:3000/admin` — create the first user on a fresh database.

### Migrate local CMS data (optional)

Copy your dev DB and media to the server:

```bash
# From your laptop
scp tigersden.db user@SERVER:/var/www/tigersden/data-import/tigersden.db
scp -r media user@SERVER:/var/www/tigersden/media-import/

# On server — copy into Docker volumes after first `up`
docker compose down
cp data-import/tigersden.db ./data/tigersden.db   # or docker volume path
docker compose up -d
```

## 5. HTTPS with Caddy (recommended)

1. Point DNS `A` record for your domain → server IP.
2. In `.env.production` add `DOMAIN=tigersden.yourdomain.com`.
3. Uncomment the `caddy` service in `docker-compose.yml`.
4. Update `deploy/Caddyfile` if needed.
5. `docker compose up -d`

Caddy obtains and renews Let's Encrypt certificates automatically.

## 6. Tours and cricket snapshots (required for `/tours`)

Tours are **not** read from `data/*.json` — they are synced from CricAPI into the Payload `cricket-snapshots` table in SQLite.

**After first deploy**, run once:

```bash
cd /var/www/tigersden
chmod +x scripts/prod-cricket-sync.sh
./scripts/prod-cricket-sync.sh
```

Or set `CRICKET_SYNC_ON_START=1` in `.env.production` and restart (`docker compose up -d`) so the container triggers sync on boot.

**Nightly refresh** (3:00 AM Bangladesh = 21:00 UTC; all jobs run between 3:00–4:00 AM BDT — see `docs/cricket-api.md`):

```bash
# crontab -e on the Hetzner VPS
0 21 * * * cd /var/www/tigersden && ./scripts/prod-cricket-sync.sh >> /var/log/tigers-cricket-sync.log 2>&1
```

You can also use **Payload admin** → Cricket Snapshots → **Run cricket sync now** (calls `POST /api/cricket-snapshots/sync`).

If the button returns **Unauthorized**, sign out and back into `/admin`. If sync errors mention a missing table, set `PAYLOAD_SQLITE_PUSH_SCHEMA=1` in `.env.production`, run `docker compose up -d` once, then remove that variable and redeploy.

## 7. Nightly JSON scrapers (GitHub Actions)

Workflows in `.github/workflows/` commit `data/icc-rankings.json`, match, and news files. On the server, pull updates periodically:

```bash
5 4 * * * cd /var/www/tigersden && git pull origin main && docker compose restart app
```

## 8. Updates

```bash
cd /var/www/tigersden
git pull origin main
docker compose build
docker compose up -d
```

## Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
# Only if not using Caddy and testing directly:
# sudo ufw allow 3000
sudo ufw enable
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Admin blank / broken styles | Rebuild image (`docker compose build --no-cache`) |
| Images 404 | Check `NEXT_PUBLIC_SERVER_URL` matches public URL |
| Empty tours / `/tours` blank | Set `CRICKET_DATA_API_KEY`, run `./scripts/prod-cricket-sync.sh` |
| Empty rankings on home | Run `npm run scrape:icc-rankings` or wait for GitHub Action + `git pull` |
| Empty cricket news | Ensure `data/*.json` is in the image or volume; run scrapers |
| Out of memory on build | Use swap or build on CI and pull image |

## Alternative: PM2 without Docker

```bash
npm ci
cp .env.production .env.local
export $(grep -v '^#' .env.production | xargs)
npm run build
npm run start
```

Use a process manager (PM2) and nginx as reverse proxy. Docker is still recommended for persistent volumes.
