# The Tigers' Den

Bangladesh cricket fan community hub — live match centre, forum, chants, and tour travel. Built with **Next.js 15**, **Payload CMS 3**, and **Tailwind CSS 4**.

## Quick start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local — set PAYLOAD_SECRET to a long random string

# Run dev server
npm run dev
```

Open:

- **Public site:** [http://localhost:3000](http://localhost:3000)
- **Admin panel:** [http://localhost:3000/admin](http://localhost:3000/admin)

On first visit to `/admin`, create your super-admin account.

## Admin — what you can manage

| Collection | Purpose |
|------------|---------|
| **Hero Slides** | Homepage hero banner images, titles, CTAs, sort order, schedule |
| **Posts** | Forum-style announcements; pin to The Stand when published |
| **Media** | Image library for slides and post covers |
| **Users** | Admin editors and moderators |

## Project structure

```
app/
  (frontend)/     # Public fan site
  (payload)/      # Payload admin + API
collections/      # CMS schema (Posts, HeroSlides, Media, Users)
components/       # UI components
design.md         # Brand guidelines
lib/              # Payload client + mock data
payload.config.ts # CMS configuration
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run generate:types` | Regenerate `payload-types.ts` from schema |

## Deployment

Production VPS / **Coolify** on Hetzner: [docs/deploy-coolify.md](docs/deploy-coolify.md)  
Manual Docker on a VPS: [docs/deploy-production.md](docs/deploy-production.md)

## Next steps

- [ ] Cricket API integration (live scores via WebSocket)
- [ ] Real-time chat for The Roar
- [ ] Chants Hub collection + audio uploads
- [ ] Tour packages collection
- [ ] User auth for public sign-in
