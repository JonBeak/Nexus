#!/bin/bash
# Switch Backend to Production Build

set -e

BACKEND_DIR="/home/jon/Nexus/backend/web"

echo "🔄 Switching to PRODUCTION backend..."
echo ""

cd "$BACKEND_DIR"

# Check if production build exists
if [ ! -d "dist-production" ]; then
    echo "❌ Production build not found!"
    echo "   Run backend-rebuild-production.sh first"
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

# Create symlink to production
ln -s dist-production dist

echo "✅ Symlink updated: dist -> dist-production"
echo ""

# Restart PM2
echo "🔄 Restarting PM2..."
pm2 restart signhouse-backend

echo ""
echo "✅ Backend switched to PRODUCTION and restarted!"
echo ""
echo "📋 Check status:"
echo "   pm2 logs signhouse-backend --lines 20"
