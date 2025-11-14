#!/bin/bash
# Switch Backend to Development Build

set -e

BACKEND_DIR="/home/jon/Nexus/backend/web"

echo "🔄 Switching to DEV backend..."
echo ""

cd "$BACKEND_DIR"

# Check if dev build exists
if [ ! -d "dist-dev" ]; then
    echo "❌ Dev build not found!"
    echo "   Run backend-rebuild-dev.sh first"
    exit 1
fi

# Remove existing symlink
if [ -L "dist" ]; then
    rm dist
elif [ -d "dist" ]; then
    echo "⚠️  'dist' is a directory, not a symlink!"
    echo "   Moving to dist-temp-$(date +%Y%m%d-%H%M%S)"
    mv dist "dist-temp-$(date +%Y%m%d-%H%M%S)"
fi

# Create symlink to dev
ln -s dist-dev dist

echo "✅ Symlink updated: dist -> dist-dev"
echo ""

# Restart PM2
echo "🔄 Restarting PM2..."
pm2 restart signhouse-backend

echo ""
echo "✅ Backend switched to DEV and restarted!"
echo ""
echo "📋 Check status:"
echo "   pm2 logs signhouse-backend --lines 20"
