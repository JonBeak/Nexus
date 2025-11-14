#!/bin/bash
# Rebuild Development Backend (Overwrites dist-dev)

set -e

BACKEND_DIR="/home/jon/Nexus/backend/web"

echo "🔨 Rebuilding DEV backend..."
echo ""

cd "$BACKEND_DIR"

# Remove symlink first to prevent building through it
if [ -L "dist" ]; then
    echo "🔗 Removing existing symlink..."
    rm dist
fi

# Build TypeScript
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

# Recreate symlink if needed
if [ -L "dist" ]; then
    rm dist
fi
ln -s dist-dev dist

echo ""
echo "✅ Dev backend rebuilt successfully!"
echo "   Location: $BACKEND_DIR/dist-dev"
echo ""
echo "⚠️  Backend not restarted - use switch-to-dev.sh to activate"
