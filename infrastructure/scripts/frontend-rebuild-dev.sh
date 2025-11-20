#!/bin/bash
# Frontend Dev Build Script
# Builds frontend to dist-dev/ directory

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="/home/jon/Nexus/frontend/web"

cd "$FRONTEND_DIR"

echo "🔨 Rebuilding DEV frontend..."
echo ""

# Remove symlink if it exists
if [ -L "dist" ]; then
    rm dist
fi

# Run dev build (same as production build, but to dist-dev)
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

# Recreate symlink
echo "🔗 Creating symlink: dist -> dist-dev"
ln -sf dist-dev dist

echo ""
echo "✅ Dev frontend rebuilt successfully!"
echo "   Location: $FRONTEND_DIR/dist-dev"
echo ""
echo "⚠️  Nginx serves from 'dist' symlink (currently -> dist-dev)"
echo "    No restart needed"
