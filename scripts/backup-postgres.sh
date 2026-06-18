#!/usr/bin/env bash
# Daily Postgres backup — run on the server via cron or Coolify scheduled task.
#
#   export POSTGRES_URL='postgresql://...'
#   ./scripts/backup-postgres.sh
#
# Optional: BACKUP_DIR=/var/backups/tigersden

set -euo pipefail

if [ -z "${POSTGRES_URL:-}" ]; then
  echo "POSTGRES_URL is not set." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/tigersden-${STAMP}.dump"

pg_dump "$POSTGRES_URL" --format=custom --no-owner --no-acl --file="$OUT"
echo "Wrote $OUT"

# Keep last 14 dumps
ls -1t "$BACKUP_DIR"/tigersden-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
