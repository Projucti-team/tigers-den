#!/bin/bash

# Local development setup script
# Removes old DB, starts dev server on port 8083, runs bootstrap

set -e

echo "🧹 Cleaning up old database files..."
rm -f tigersden.db tigersden.db-shm tigersden.db-wal

echo "🚀 Starting dev server on port 8083..."
echo "Once server is running (wait ~10s), bootstrap will run automatically in another terminal."
echo ""
echo "If bootstrap doesn't run, manually call:"
echo "  curl -X POST http://localhost:8083/api/admin/bootstrap-db"
echo ""

PORT=8083 npm run dev &
DEV_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
sleep 10

echo "🔧 Running database bootstrap..."
curl -X POST http://localhost:8083/api/admin/bootstrap-db

echo "✅ Setup complete!"
echo "   Admin panel: http://localhost:8083/admin"
echo "   Create your first admin user on login screen"

wait $DEV_PID
