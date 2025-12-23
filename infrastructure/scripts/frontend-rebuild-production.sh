#!/bin/bash
# Frontend Production Build Script
# Builds frontend to dist-production/ directory
# WARNING: This deploys to production immediately (Nginx serves dist-production)

set -e

FRONTEND_DIR="/home/jon/Nexus/frontend/web"

cd "$FRONTEND_DIR"

echo "🔨 Rebuilding PRODUCTION frontend..."
echo ""

# Backup old production BEFORE building
if [ -d "dist-production" ] && [ ! -L "dist-production" ]; then
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_DIR="dist-production-backup-$TIMESTAMP"
    echo "📁 Backing up old production to $BACKUP_DIR"
    mv dist-production "$BACKUP_DIR"
fi

# Run production build with output dir override
echo "📦 Running Vite production build..."
VITE_OUT_DIR=dist-production npm run build

# Verify build succeeded
if [ -d "dist-production" ]; then
    echo "✅ Production frontend built successfully!"
    echo "   Location: $FRONTEND_DIR/dist-production"
else
    echo "❌ Build failed - dist-production not created"
    exit 1
fi

echo ""
echo "🌐 Nginx serves directly from dist-production"
echo "   Run: sudo systemctl reload nginx"
echo "   Or hard-refresh browser to see changes"
