# The Tigers' Den

Bangladesh cricket fan community hub — live match centre, ICC rankings, tours, **The Roar** live chat, **The Stand** social feed, and member profiles.

Built with **Next.js 16**, **Payload CMS 3**, **Tailwind CSS 4**, **NextAuth**, and **Firebase Firestore** (real-time chat).

**Production:** [Coolify](docs/deploy-coolify.md) on Hetzner with **Postgres on the same server** and **Firestore** for chat.

---

## Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local — at minimum set PAYLOAD_SECRET (openssl rand -base64 32)
npm run dev
```

| URL | Purpose |
|-----|---------|
| [http://localhost:3000](http://localhost:3000) | Public fan site |
| [http://localhost:3000/admin](http://localhost:3000/admin) | Payload CMS (create super-admin on first visit) |

Local dev uses **SQLite** (`DATABASE_URI=file:./tigersden.db`). Production uses **Postgres** via `POSTGRES_URL`. See [docs/architecture.md](docs/architecture.md).

---

## What the site does

| Area | Route | Summary |
|------|-------|---------|
| **Home** | `/` | Hero, live marquee, rankings teaser, news, tours |
| **Match centre** | `/match-centre` | Live scores, scorecard, venue weather, **The Roar** chat |
| **Rankings** | `/rankings` | ICC team + player rankings (men & women), WTC |
| **Tours** | `/tours`, `/tours/[slug]` | Bangladesh series, fixtures, squads, venues |
| **The Stand** | `/the-stand` | Member posts, reactions, comments |
| **Profiles** | `/profile`, `/profile/[username]` | Member pages, follow, avatar |
| **Join** | `/join` | Google / Facebook sign-in |
| **Chants** | `/chants` | Fan chants (CMS) |
| **About** | `/about` | Site info |

---

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/architecture.md](docs/architecture.md) | System design, data stores, providers, collections |
| [docs/jobs.md](docs/jobs.md) | Nightly cron, GitHub Actions, deploy bootstrap, scripts |
| [docs/cricket-api.md](docs/cricket-api.md) | Cricket providers, API routes, rankings shape |
| [docs/firebase-chat.md](docs/firebase-chat.md) | The Roar — Firestore setup and security rules |
| [docs/deploy-coolify.md](docs/deploy-coolify.md) | **Primary** production deploy (Coolify + Hetzner) |
| [docs/migrate-neon-to-server-postgres.md](docs/migrate-neon-to-server-postgres.md) | Move CMS DB off Neon to server Postgres |
| [docs/deploy-production.md](docs/deploy-production.md) | Manual Docker on a VPS |
| [design.md](design.md) | Brand guidelines |

---

## Project structure

```
app/
  (frontend)/          # Public pages (match centre, tours, stand, …)
  (payload)/           # Payload admin UI + REST
  api/                 # Next.js API routes (cricket, social, chat, cron)
collections/           # Payload CMS schema
components/            # React UI
lib/
  cricket/             # Providers, snapshots, tour/ranking services
  firebase/            # Firestore client + admin
  match-chat/          # The Roar (Firestore-backed)
  social/              # Members, posts, follow graph
  stand/               # Reactions, comments
data/                  # JSON caches (ICC, WTC, news, last match) — committed + volume on prod
deploy/                # Docker entrypoint, production helpers
docs/                  # Architecture, deploy, jobs
scripts/               # Scrapers, sync helpers, backups
payload.config.ts
```

---

## npm scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run generate:types` | Regenerate `payload-types.ts` from CMS schema |
| `npm run generate:importmap` | Regenerate Payload admin import map (required before Docker build) |
| `npm run sync:cricket` | Trigger `POST /api/cron/cricket` locally (dev server must be running) |
| `npm run scrape:icc-rankings` | Refresh `data/icc-rankings.json` |
| `npm run scrape:wtc-standings` | Refresh `data/wtc-standings.json` |
| `npm run scrape:bangladesh-match` | Refresh `data/bangladesh-last-match.json` |
| `npm run scrape:bangladesh-news` | Refresh `data/bangladesh-cricket-news.json` |
| `npm run scrape:espn-squads` | Refresh `data/espn-tour-squads.json` |

Full job schedule and server cron setup: [docs/jobs.md](docs/jobs.md).

---

## Environment variables

Copy `.env.example` → `.env.local` for development, or `.env.production.example` for production.

| Group | Key variables |
|-------|----------------|
| **CMS** | `PAYLOAD_SECRET`, `DATABASE_URI` (local) or `POSTGRES_URL` (prod) |
| **Site** | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SERVER_URL` |
| **Members** | `AUTH_SECRET`, `GOOGLE_*`, `FACEBOOK_*` |
| **Cricket** | `CRICKET_DATA_API_KEY`, `CRICKET_DATA_API_KEY_FALLBACK`, `CRON_SECRET` |
| **Chat** | `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |

---

## Deployment (summary)

1. Push to Git → Coolify builds `Dockerfile` and deploys to Hetzner.
2. Mount volumes: `/app/data` (JSON caches), `/app/media` (CMS uploads).
3. Set `POSTGRES_URL` (Coolify Postgres resource) — do **not** use `DATABASE_URI=file:...` in prod.
4. Set `CRON_SECRET` — protects bootstrap and nightly cricket sync.
5. Configure Firebase for live chat — [docs/firebase-chat.md](docs/firebase-chat.md).
6. Schedule nightly `POST /api/cron/cricket` — [docs/jobs.md](docs/jobs.md).

Details: [docs/deploy-coolify.md](docs/deploy-coolify.md).

---

## Admin (Payload CMS)

Editors manage content at `/admin`:

| Collection | Purpose |
|------------|---------|
| **Hero Slides** | Homepage banner images, titles, CTAs |
| **Posts** | Announcements; can pin to The Stand |
| **Chants** | Fan chant library |
| **Media** | Image uploads |
| **Users** | Admin / moderator accounts |
| **Members**, **MemberPosts**, **Stand\*** | Social graph (mostly API-driven) |
| **Players**, **Countries** | Player registry for rankings / profiles |
| **CricketSnapshots** | Pre-built tour & ranking pages (written by cron) |

Member-facing auth is **NextAuth** (OAuth), not Payload Users.
