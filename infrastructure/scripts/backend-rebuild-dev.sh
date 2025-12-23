#!/bin/bash
# Rebuild Development Backend (Overwrites dist-dev)
# Used in dual-instance setup where dev runs on port 3002

set -e

BACKEND_DIR="/home/jon/Nexus/backend/web"

echo "🔨 Rebuilding DEV backend..."
echo ""

cd "$BACKEND_DIR"

# Build TypeScript to temp dist folder
echo "📦 Running TypeScript build..."
npm run build

# Check if build succeeded
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not created"
    exit 1
fi

# Backup old dev if it exists
if [ -d "dist-dev" ]; then
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    echo "📁 Backing up old dev to dist-dev-backup-$TIMESTAMP"
    mv dist-dev "dist-dev-backup-$TIMESTAMP"
fi

# Move new build to dev
echo "✅ Moving new build to dist-dev"
mv dist dist-dev

echo ""
echo "✅ Dev backend rebuilt successfully!"
echo "   Location: $BACKEND_DIR/dist-dev"
echo ""

# Restart the dev PM2 instance
echo "🔄 Restarting signhouse-backend-dev (port 3002)..."
pm2 restart signhouse-backend-dev

echo ""
echo "✅ Dev backend rebuilt and restarted!"
echo ""
echo "📋 Check logs: pm2 logs signhouse-backend-dev --lines 20"
echo "🌐 Dev API: http://192.168.2.14:3002"
