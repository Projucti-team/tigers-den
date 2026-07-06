#!/bin/bash

# Local development setup script
# Starts Postgres via Docker Compose, dev server, runs bootstrap

set -e

echo "🐘 Starting Postgres via Docker Compose..."
docker compose -f docker-compose.postgres.yml up -d postgres

echo "⏳ Waiting for Postgres to be healthy..."
for i in {1..30}; do
  if docker compose -f docker-compose.postgres.yml exec -T postgres pg_isready -U tigersden -d tigersden > /dev/null 2>&1; then
    echo "✅ Postgres ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ Postgres failed to start"
    exit 1
  fi
  sleep 1
done

echo "🚀 Starting dev server on port 8083..."
export DATABASE_URI=""
export POSTGRES_URL="postgresql://tigersden:tigersden@localhost:5432/tigersden"
PORT=8083 npm run dev &
DEV_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for dev server to start..."
sleep 10

echo "🔧 Running database bootstrap..."
curl -X POST http://localhost:8083/api/admin/bootstrap-db

echo "✅ Setup complete!"
echo "   Admin panel: http://localhost:8083/admin"
echo "   Database: PostgreSQL (matches production)"
echo "   Stop with: docker compose -f docker-compose.postgres.yml down"
echo ""

wait $DEV_PID
