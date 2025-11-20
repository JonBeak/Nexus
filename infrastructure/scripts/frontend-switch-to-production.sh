#!/bin/bash
# Switch Frontend to Production Build
# Updates symlink and nginx serves the new build automatically

set -e

FRONTEND_DIR="/home/jon/Nexus/frontend/web"

cd "$FRONTEND_DIR"

echo "🔄 Switching to PRODUCTION frontend..."
echo ""

# Check if production build exists
if [ ! -d "dist-production" ]; then
    echo "❌ Error: dist-production does not exist"
    echo "   Run frontend-rebuild-production.sh first"
    exit 1
fi

# Remove old symlink
if [ -L "dist" ]; then
    rm dist
elif [ -d "dist" ]; then
    echo "⚠️  Warning: 'dist' is a directory, not a symlink. Moving to backup..."
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    mv dist "dist-orphan-$TIMESTAMP"
fi

# Create new symlink
ln -sf dist-production dist

echo "✅ Symlink updated: dist -> dist-production"
echo ""
echo "✅ Frontend switched to PRODUCTION!"
echo ""
echo "🌐 Nginx automatically serves new build from /dist"
echo "   No restart needed - changes effective immediately"
