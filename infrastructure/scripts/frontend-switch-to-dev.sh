#!/bin/bash
# Switch Frontend to Dev Build
# Updates symlink and nginx serves the new build automatically

set -e

FRONTEND_DIR="/home/jon/Nexus/frontend/web"

cd "$FRONTEND_DIR"

echo "🔄 Switching to DEV frontend..."
echo ""

# Check if dev build exists
if [ ! -d "dist-dev" ]; then
    echo "❌ Error: dist-dev does not exist"
    echo "   Run frontend-rebuild-dev.sh first"
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
ln -sf dist-dev dist

echo "✅ Symlink updated: dist -> dist-dev"
echo ""
echo "✅ Frontend switched to DEV!"
echo ""
echo "🌐 Nginx automatically serves new build from /dist"
echo "   No restart needed - changes effective immediately"
