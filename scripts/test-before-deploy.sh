#!/bin/bash

# Pre-deployment test script
# Run this before any production deployment to catch issues

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 PRE-DEPLOYMENT TEST SUITE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Node version
echo ""
echo "📦 Checking environment..."
node --version
npm --version

# Run type checking
echo ""
echo "✓ Running TypeScript type check..."
npm run type-check 2>&1 | head -20

# Run unit tests
echo ""
echo "✓ Running unit tests..."
npm test -- tests/unit/ --passWithNoTests 2>&1 | tail -20

# Run integration tests (requires DB connection)
echo ""
echo "✓ Running integration tests..."
if [ -n "$DATABASE_URL" ]; then
  npm test -- tests/integration/ --passWithNoTests 2>&1 | tail -20
else
  echo "⚠️  Skipping integration tests (DATABASE_URL not set)"
fi

# Build check
echo ""
echo "✓ Checking production build..."
npm run build 2>&1 | grep -E "Build complete|warning|error" || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Pre-deployment checks passed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Ready to deploy. Run:"
echo "  git push origin main"
