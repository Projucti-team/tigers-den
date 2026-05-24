# Deploy for free (no server to buy)

**Recommended stack — $0/month** for a fan-site scale project:

| Service | Free tier | Used for |
|---------|-----------|----------|
| [Vercel](https://vercel.com) Hobby | Hosting Next.js + Payload | Site + admin |
| [Neon](https://neon.tech) via Vercel | Postgres database | CMS data |
| [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) | File storage | Hero images, media |
| [GitHub](https://github.com) | Actions (already in repo) | Nightly cricket JSON updates |

Cricket **news** and **ICC rankings** stay free (RSS/scrape, no API bill). **CricAPI** is optional (~100 requests/day on free tier).

---

## Step 1 — Push code to GitHub

```bash
cd /path/to/tigersden
git init
git add .
git commit -m "Prepare for Vercel deploy"
# Create a new repo on github.com, then:
git remote add origin git@github.com:YOUR_USER/tigersden.git
git push -u origin main
```

Ensure `data/*.json` is committed (cricket caches for the home page).

---

## Step 2 — Deploy on Vercel (one-time setup)

1. Sign up at [vercel.com](https://vercel.com) (free Hobby plan).
2. Click **Add New → Project** → import your GitHub repo.
3. **Before Deploy**, open **Storage** (or Integrations):

### Database (Neon Postgres)

1. **Storage → Create Database → Postgres** (Neon).
2. Name it e.g. `tigersden-db`, region near you.
3. Connect it to this project — Vercel sets `POSTGRES_URL` automatically.

### Media (Vercel Blob)

1. **Storage → Create Database → Blob**.
2. Connect to the project — Vercel sets `BLOB_READ_WRITE_TOKEN`.

### Environment variables

In **Project → Settings → Environment Variables**, add:

| Variable | Value |
|----------|--------|
| `PAYLOAD_SECRET` | Run `openssl rand -base64 32` and paste |
| `NEXT_PUBLIC_SITE_URL` | Leave empty on first deploy; set to `https://your-app.vercel.app` after deploy |
| `NEXT_PUBLIC_SERVER_URL` | Same as `NEXT_PUBLIC_SITE_URL` |
| `CRICKET_DATA_API_KEY` | Required for tours/rankings snapshots — from [cricketdata.org](https://cricketdata.org/signup.aspx) |
| `CRON_SECRET` | Run `openssl rand -base64 32` — protects bootstrap + cron routes |

`POSTGRES_URL` and `BLOB_READ_WRITE_TOKEN` are set by the storage integrations.

4. Click **Deploy**.

Each Vercel build runs **`deploy:migrate` then `next build`**: creates Postgres tables if missing, then (during the build) seeds cricket snapshots before static pages are generated. First deploy with an empty DB may take ~5–8 minutes when cricket sync runs.

---

## Step 3 — After deploy

1. Open `https://YOUR-PROJECT.vercel.app`
2. Open `https://YOUR-PROJECT.vercel.app/admin`
3. Create your **first admin user** (fresh Neon DB).
4. In Vercel env vars, set:
   - `NEXT_PUBLIC_SITE_URL` = `https://YOUR-PROJECT.vercel.app`
   - `NEXT_PUBLIC_SERVER_URL` = same  
   Then **Redeploy** (Deployments → … → Redeploy).

Upload hero slides and posts in admin — images go to Vercel Blob automatically.

---

## Custom domain (optional, still free on Vercel)

1. Vercel → Project → **Domains** → add `tigersden.yourdomain.com`
2. Add the DNS records your registrar shows
3. Update `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_SERVER_URL` to `https://tigersden.yourdomain.com`
4. Redeploy

---

## How cricket data updates (free)

GitHub Actions in `.github/workflows/` already refresh `data/icc-rankings.json`, `data/bangladesh-last-match.json`, and `data/bangladesh-cricket-news.json` on a schedule.

After each Action run:

- It commits to `main` → Vercel **auto-redeploys** with fresh JSON (no extra cost).

`CRICKET_DATA_API_KEY` powers tours, squads, and rankings snapshots (nightly cron + first deploy seed).

**Manual re-seed** (after deploy, if data is still empty):

```bash
curl -X POST "https://YOUR-PROJECT.vercel.app/api/admin/bootstrap-db?forceCricketSync=1" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Then redeploy or wait for the next build so static pages pick up the new DB snapshots.

---

## Local dev (unchanged)

Without `POSTGRES_URL`, the app uses **SQLite** + local `media/` folder:

```bash
cp .env.example .env.local
npm run dev
```

To develop against production Neon, copy `POSTGRES_URL` from Vercel into `.env.local` (use a dev branch DB if you prefer).

---

## Limits to know (free tier)

| Limit | Impact |
|-------|--------|
| Vercel serverless execution time | Fine for this site; admin uploads use **client uploads** to Blob |
| Neon storage/compute | Plenty for CMS + forum posts |
| Blob storage | 1 GB on hobby — enough for images |
| CricAPI | ~100 calls/day if you add a key |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Admin 500 on deploy | Check `PAYLOAD_SECRET` and `POSTGRES_URL` in Vercel |
| Images broken | Set `NEXT_PUBLIC_SERVER_URL`; confirm Blob storage connected |
| Empty rankings | Ensure `data/*.json` is in Git; check GitHub Actions ran |
| Build fails | Check build logs; run `npm run build` locally |

---

## Not using Vercel?

See [deploy-production.md](./deploy-production.md) for a paid VPS + Docker path (only if you outgrow free hosting).
