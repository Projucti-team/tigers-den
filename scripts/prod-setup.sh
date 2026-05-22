#!/usr/bin/env bash
# First-time production setup on a VPS (Ubuntu/Debian).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.production ]]; then
  echo "Create .env.production from .env.production.example and set PAYLOAD_SECRET + NEXT_PUBLIC_SITE_URL."
  cp .env.production.example .env.production
  echo "Generated .env.production — edit it before continuing."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker…"
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
  echo "Log out and back in so Docker group applies, then re-run this script."
  exit 0
fi

echo "Building and starting Tigers' Den…"
docker compose build --no-cache
docker compose up -d

echo ""
echo "App running on http://localhost:3000"
echo "Admin: http://localhost:3000/admin (create first user if new DB)"
echo ""
echo "Next: point your domain to this server and enable Caddy in docker-compose.yml"
