#!/bin/bash
# Rebuild Production Backend (Overwrites dist-production)

set -e

BACKEND_DIR="/home/jon/Nexus/backend/web"

echo "🔨 Rebuilding PRODUCTION backend..."
echo ""

cd "$BACKEND_DIR"

# Build TypeScript
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

# Recreate symlink if needed
if [ -L "dist" ]; then
    rm dist
fi
ln -s dist-production dist

echo ""
echo "✅ Production backend rebuilt successfully!"
echo "   Location: $BACKEND_DIR/dist-production"
echo ""
echo "⚠️  Backend not restarted - use switch-to-production.sh to activate"
