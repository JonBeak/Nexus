#!/bin/bash
# Rebuild Production Backend (Overwrites dist-production)
# Used in dual-instance setup where production runs on port 3001

set -e

BACKEND_DIR="/home/jon/Nexus/backend/web"

echo "🔨 Rebuilding PRODUCTION backend..."
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

# Backup old production if it exists
if [ -d "dist-production" ]; then
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    echo "📁 Backing up old production to dist-production-backup-$TIMESTAMP"
    mv dist-production "dist-production-backup-$TIMESTAMP"
fi

# Move new build to production
echo "✅ Moving new build to dist-production"
mv dist dist-production

echo ""
echo "✅ Production backend rebuilt successfully!"
echo "   Location: $BACKEND_DIR/dist-production"
echo ""

# Restart the production PM2 instance
echo "🔄 Restarting signhouse-backend (port 3001)..."
pm2 restart signhouse-backend

echo ""
echo "✅ Production backend rebuilt and restarted!"
echo ""
echo "📋 Check logs: pm2 logs signhouse-backend --lines 20"
echo "🌐 Production API: http://192.168.2.14:3001"
