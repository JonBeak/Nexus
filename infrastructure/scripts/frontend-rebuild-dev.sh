#!/bin/bash
# Frontend Dev Build Script
# Builds frontend to dist-dev/ directory
# NOTE: This only affects dev builds. Production is completely isolated.

set -e

FRONTEND_DIR="/home/jon/Nexus/frontend/web"

cd "$FRONTEND_DIR"

echo "🔨 Rebuilding DEV frontend..."
echo ""

# Run dev build
echo "📦 Running Vite build..."
npm run build

# Backup old dev build if it exists
if [ -d "dist-dev" ]; then
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_DIR="dist-dev-backup-$TIMESTAMP"
    echo "📁 Backing up old dev to $BACKUP_DIR"
    mv dist-dev "$BACKUP_DIR"
fi

# Move new build to dist-dev
if [ -d "dist" ] && [ ! -L "dist" ]; then
    echo "✅ Moving new build to dist-dev"
    mv dist dist-dev
else
    echo "❌ Build failed - dist not created"
    exit 1
fi

echo ""
echo "✅ Dev frontend rebuilt successfully!"
echo "   Location: $FRONTEND_DIR/dist-dev"
echo ""
echo "📝 Note: Vite dev server on :5173 uses hot-reload (no rebuild needed for dev)"
echo "         Production on duckdns is unaffected by this build"
