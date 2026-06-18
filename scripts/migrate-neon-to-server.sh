#!/usr/bin/env bash
# Export Neon Postgres and restore into server Postgres (Coolify).
#
# Usage:
#   export NEON_URL='postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require'
#   export SERVER_POSTGRES_URL='postgresql://user:pass@postgres-xxx:5432/tigersden'
#   ./scripts/migrate-neon-to-server.sh
#
# Run from a machine that can reach BOTH databases (your laptop for Neon;
# use SSH on the Hetzner box for SERVER_POSTGRES_URL if it is internal-only).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DUMP_DIR="${DUMP_DIR:-$ROOT/backups/migration}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
DUMP="$DUMP_DIR/tigersden-neon-${STAMP}.dump"

if [ -z "${NEON_URL:-}" ]; then
  echo "Set NEON_URL to your Neon connection string." >&2
  exit 1
fi

if [ -z "${SERVER_POSTGRES_URL:-}" ]; then
  echo "Set SERVER_POSTGRES_URL to the Coolify Postgres internal URL." >&2
  exit 1
fi

command -v pg_dump >/dev/null || { echo "pg_dump not found. Install PostgreSQL client tools." >&2; exit 1; }
command -v pg_restore >/dev/null || { echo "pg_restore not found." >&2; exit 1; }

PG_DUMP="$(command -v pg_dump)"
PG_RESTORE="$(command -v pg_restore)"
PG_DUMP_VERSION="$("$PG_DUMP" --version | awk '{print $3}' | cut -d. -f1)"
if [ "$PG_DUMP_VERSION" -lt 17 ] 2>/dev/null; then
  for candidate in /opt/homebrew/opt/postgresql@17/bin /usr/local/opt/postgresql@17/bin; do
    if [ -x "$candidate/pg_dump" ]; then
      PG_DUMP="$candidate/pg_dump"
      PG_RESTORE="$candidate/pg_restore"
      break
    fi
  done
fi

echo "Using $PG_DUMP ($($PG_DUMP --version))"

mkdir -p "$DUMP_DIR"

echo "==> Dumping Neon → $DUMP"
"$PG_DUMP" "$NEON_URL" --format=custom --no-owner --no-acl --file="$DUMP"
echo "    Done ($(du -h "$DUMP" | cut -f1))"

echo "==> Restoring into server Postgres"
"$PG_RESTORE" --no-owner --no-acl --clean --if-exists --dbname="$SERVER_POSTGRES_URL" "$DUMP"
echo "    Done"

echo ""
echo "Next steps:"
echo "  1. Coolify → app env: set POSTGRES_URL to SERVER_POSTGRES_URL (internal URL)"
echo "  2. Remove DATABASE_URI if set to file:..."
echo "  3. Keep PAYLOAD_SECRET unchanged"
echo "  4. Redeploy the app"
echo "  5. curl -X POST https://tigersden.bd/api/admin/bootstrap-db -H \"Authorization: Bearer \$CRON_SECRET\""
echo "  6. curl -X POST 'https://tigersden.bd/api/cron/cricket?force=1' -H \"Authorization: Bearer \$CRON_SECRET\""
echo ""
echo "Archive dump kept at: $DUMP"
