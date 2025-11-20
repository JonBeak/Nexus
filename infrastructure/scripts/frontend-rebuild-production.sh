#!/bin/bash
# Frontend Production Build Script
# Builds frontend to dist-production/ directory

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="/home/jon/Nexus/frontend/web"

cd "$FRONTEND_DIR"

echo "🔨 Rebuilding PRODUCTION frontend..."
echo ""

# Run production build with output dir override
echo "📦 Running Vite production build..."
VITE_OUT_DIR=dist-production npm run build

# Create backup of old production if it exists
if [ -d "dist-production" ] && [ ! -L "dist-production" ]; then
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_DIR="dist-production-backup-$TIMESTAMP"
    echo "📁 Backing up old production to $BACKUP_DIR"
    mv dist-production "$BACKUP_DIR"
fi

# Move new build to production
if [ -d "dist-production" ]; then
    echo "✅ Production frontend built successfully!"
    echo "   Location: $FRONTEND_DIR/dist-production"
else
    echo "❌ Build failed - dist-production not created"
    exit 1
fi

echo ""
echo "⚠️  Frontend not restarted - nginx serves from 'dist' symlink"
echo "    Use frontend-switch-to-production.sh to activate"
