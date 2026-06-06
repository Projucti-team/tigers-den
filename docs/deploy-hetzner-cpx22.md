# Deploy on Hetzner CPX22

**CPX22:** 2 shared vCPU, 4 GB RAM, 80 GB NVMe (~€7/mo). Enough for The Tigers' Den with swap and the Docker path in this repo. Upgrade to **CPX32** (4 vCPU / 8 GB) later without changing the deploy flow — resize in Hetzner, reboot, same volumes.

## Before you start

| Item | Notes |
|------|--------|
| **Server** | Ubuntu 24.04, location EU (Helsinki/Nuremberg) for BD + EU users |
| **Domain** | Optional at first; test on `http://SERVER_IP:3000` |
| **Secrets** | Copy from Vercel or generate new (`openssl rand -base64 32`) |

Do **not** set `BLOB_READ_WRITE_TOKEN` on the VPS — CMS uploads use the `tigersden-media` Docker volume.

## 1. Create the server

1. Hetzner Cloud → **Add server** → **CPX22** (x86, not CAX/ARM).
2. Image: **Ubuntu 24.04**.
3. SSH key added.
4. Firewall: allow **22**, **80**, **443** (or use Hetzner firewall + `ufw` below).

## 2. SSH and clone

```bash
ssh root@YOUR_SERVER_IP

# Non-root deploy user (recommended)
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy/
su - deploy

sudo mkdir -p /var/www/tigersden
sudo chown $USER:$USER /var/www/tigersden
git clone git@github.com:Projucti-team/tigers-den.git /var/www/tigersden
cd /var/www/tigersden
```

## 3. Swap (important on 4 GB)

```bash
chmod +x scripts/hetzner-add-swap.sh
./scripts/hetzner-add-swap.sh
```

## 4. Environment

```bash
cp .env.production.example .env.production
nano .env.production
```

Minimum:

```env
PAYLOAD_SECRET=<openssl rand -base64 32>
NEXT_PUBLIC_SITE_URL=https://tigers-den.yourdomain.com
NEXT_PUBLIC_SERVER_URL=https://tigers-den.yourdomain.com
DATABASE_URI=file:/app/data/tigersden.db
CRICKET_DATA_API_KEY=<your key>
CRON_SECRET=<openssl rand -base64 32>
AUTH_SECRET=<openssl rand -base64 32>
```

Optional: Google/Facebook OAuth vars from `.env.example`.

**Keeping Neon Postgres from Vercel:** set `POSTGRES_URL=...` and **remove** the `DATABASE_URI` line. Migrations run via bootstrap (see step 7).

## 5. Build and start

```bash
chmod +x scripts/prod-setup.sh
./scripts/prod-setup.sh
```

First build can take **15–25 minutes** on CPX22. Watch: `docker compose logs -f app`.

Open:

- Site: `http://SERVER_IP:3000`
- Admin: `http://SERVER_IP:3000/admin`

Create the first CMS user if the database is new.

## 6. Seed cricket data

```bash
chmod +x scripts/hetzner-bootstrap.sh
CRON_SECRET='your-cron-secret' ./scripts/hetzner-bootstrap.sh
```

Or manually:

```bash
curl -X POST "http://127.0.0.1:3000/api/admin/bootstrap-db?forceCricketSync=1" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 7. HTTPS (Caddy)

1. Point DNS **A** record → server IP.
2. In `.env.production` set `DOMAIN=tigers-den.yourdomain.com`.
3. Uncomment the `caddy` service and `caddy-data` / `caddy-config` volumes in `docker-compose.yml`.
4. Update `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_SERVER_URL` to `https://...`.
5. Restart:

```bash
docker compose up -d
```

Only ports **80** and **443** need to be public after Caddy is enabled (you can stop publishing `3000` later).

## 8. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 9. Nightly cricket sync

```bash
crontab -e
```

```cron
0 21 * * * curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://tigers-den.yourdomain.com/api/cron/cricket
```

## 10. Updates

```bash
cd /var/www/tigersden
git pull origin main
docker compose build
docker compose up -d
```

## Upgrade to CPX32

1. Hetzner console → server → **Resize** → CPX32 → power off/on if asked.
2. No code changes; same `docker compose` and volumes.
3. Optional: reduce or remove swap after upgrade.

## Leaving Vercel

1. Run CPX22 until site + admin + cricket data look good.
2. Switch DNS to Hetzner.
3. Disable Vercel project (keep Neon only if you still use `POSTGRES_URL`).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build killed / OOM | Run `scripts/hetzner-add-swap.sh`, retry build; or build image in GitHub Actions |
| Empty tours/rankings | Run `scripts/hetzner-bootstrap.sh` with `CRON_SECRET` |
| Admin blank | Use `https://` URLs in env; hard refresh; check `docker compose logs app` |
| Images 404 | `NEXT_PUBLIC_SERVER_URL` must match public URL; no `BLOB_READ_WRITE_TOKEN` on VPS |

## Related docs

- [deploy-production.md](./deploy-production.md) — generic VPS/Docker notes
- [deploy-free.md](./deploy-free.md) — Vercel path (legacy)
