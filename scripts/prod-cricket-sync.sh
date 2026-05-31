#!/usr/bin/env bash
# Trigger tours + rankings sync on a running Docker/VPS deployment.
# Usage (on Hetzner): ./scripts/prod-cricket-sync.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.production ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi

BASE="${NEXT_PUBLIC_SITE_URL:-http://127.0.0.1:3000}"
BASE="${BASE%/}"
SECRET="${CRON_SECRET:-}"

if [[ -z "$SECRET" ]]; then
  echo "CRON_SECRET is not set in .env.production"
  exit 1
fi

URL="${BASE}/api/cron/cricket"
echo "POST $URL"

if command -v docker >/dev/null 2>&1 && docker compose ps -q app 2>/dev/null | grep -q .; then
  docker compose exec -T app wget -qO- \
    --post-data="" \
    --header="Authorization: Bearer ${SECRET}" \
    "http://127.0.0.1:3000/api/cron/cricket" \
    || { echo "Sync request failed"; exit 1; }
  echo ""
  echo "Cricket sync triggered via container."
  exit 0
fi

if command -v curl >/dev/null 2>&1; then
  curl -fsS -X POST "$URL" -H "Authorization: Bearer ${SECRET}"
  echo ""
  echo "Cricket sync finished."
  exit 0
fi

echo "Install curl or run from a machine with docker compose."
exit 1
