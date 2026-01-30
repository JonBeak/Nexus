#!/bin/bash
# Create backups of current production and dev builds

set -e

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
COMMIT=$(cd /home/jon/Nexus && git rev-parse --short HEAD)

echo "💾 Creating Build Backups..."
echo "   Timestamp: $TIMESTAMP"
echo "   Commit: $COMMIT"
echo ""

# Backend Production
if [ -d "/home/jon/Nexus/backend/web/dist-production" ]; then
    echo "📦 Backing up backend production..."
    cd /home/jon/Nexus/backend/web
    tar -czf "/home/jon/Nexus/infrastructure/backups/backend-builds/dist-production-$TIMESTAMP-commit-$COMMIT.tar.gz" dist-production/
    BACKEND_SIZE=$(du -sh "/home/jon/Nexus/infrastructure/backups/backend-builds/dist-production-$TIMESTAMP-commit-$COMMIT.tar.gz" | cut -f1)
    echo "   ✅ Backend production: $BACKEND_SIZE"
else
    echo "   ⚠️  Backend production not found"
fi

# Backend Dev
if [ -d "/home/jon/Nexus/backend/web/dist-dev" ]; then
    echo "📦 Backing up backend dev..."
    cd /home/jon/Nexus/backend/web
    tar -czf "/home/jon/Nexus/infrastructure/backups/backend-builds/dist-dev-$TIMESTAMP-commit-$COMMIT.tar.gz" dist-dev/
    BACKEND_DEV_SIZE=$(du -sh "/home/jon/Nexus/infrastructure/backups/backend-builds/dist-dev-$TIMESTAMP-commit-$COMMIT.tar.gz" | cut -f1)
    echo "   ✅ Backend dev: $BACKEND_DEV_SIZE"
else
    echo "   ⚠️  Backend dev not found"
fi

# Frontend Production
if [ -d "/home/jon/Nexus/frontend/web/dist-production" ]; then
    echo "📦 Backing up frontend production..."
    cd /home/jon/Nexus/frontend/web
    tar -czf "/home/jon/Nexus/infrastructure/backups/frontend-builds/dist-production-$TIMESTAMP-commit-$COMMIT.tar.gz" dist-production/
    FRONTEND_SIZE=$(du -sh "/home/jon/Nexus/infrastructure/backups/frontend-builds/dist-production-$TIMESTAMP-commit-$COMMIT.tar.gz" | cut -f1)
    echo "   ✅ Frontend production: $FRONTEND_SIZE"
else
    echo "   ⚠️  Frontend production not found"
fi

echo ""
echo "✅ Backup complete!"
echo ""
echo "📋 View backups: list-backups.sh"
