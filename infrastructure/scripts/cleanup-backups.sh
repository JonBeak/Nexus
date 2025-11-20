#!/bin/bash
# Clean up old build backups (keep last N)

KEEP_COUNT=${1:-10}

echo "🗑️  Cleaning up old backups (keeping last $KEEP_COUNT)..."
echo ""

# Backend dev backups (keep fewer - these are created often)
echo "🔧 Backend dev build backups..."
cd /home/jon/Nexus/backend/web
DEV_BACKUP_COUNT=$(ls -1 dist-dev-backup-* 2>/dev/null | wc -l)
if [ $DEV_BACKUP_COUNT -gt $KEEP_COUNT ]; then
    TO_DELETE=$((DEV_BACKUP_COUNT - KEEP_COUNT))
    echo "   Found $DEV_BACKUP_COUNT backups, removing oldest $TO_DELETE..."
    ls -1t dist-dev-backup-* | tail -n $TO_DELETE | xargs rm -rf
    echo "   ✅ Removed $TO_DELETE old dev backups"
else
    echo "   ✅ Only $DEV_BACKUP_COUNT backups, no cleanup needed"
fi

# Backend archived backups (keep more - these are intentional)
echo ""
echo "🔧 Backend archived backups..."
BACKEND_COUNT=$(ls -1 /home/jon/Nexus/infrastructure/backups/backend-builds/*.tar.gz 2>/dev/null | wc -l)
if [ $BACKEND_COUNT -gt 20 ]; then
    cd /home/jon/Nexus/infrastructure/backups/backend-builds/
    TO_DELETE=$((BACKEND_COUNT - 20))
    echo "   Found $BACKEND_COUNT archives, removing oldest $TO_DELETE..."
    ls -1t *.tar.gz | tail -n $TO_DELETE | xargs rm -f
    echo "   ✅ Removed $TO_DELETE old archives"
else
    echo "   ✅ Only $BACKEND_COUNT archives, no cleanup needed"
fi

# Frontend archived backups
echo ""
echo "🌐 Frontend archived backups..."
FRONTEND_COUNT=$(ls -1 /home/jon/Nexus/infrastructure/backups/frontend-builds/*.tar.gz 2>/dev/null | wc -l)
if [ $FRONTEND_COUNT -gt 20 ]; then
    cd /home/jon/Nexus/infrastructure/backups/frontend-builds/
    TO_DELETE=$((FRONTEND_COUNT - 20))
    echo "   Found $FRONTEND_COUNT archives, removing oldest $TO_DELETE..."
    ls -1t *.tar.gz | tail -n $TO_DELETE | xargs rm -f
    echo "   ✅ Removed $TO_DELETE old archives"
else
    echo "   ✅ Only $FRONTEND_COUNT archives, no cleanup needed"
fi

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📋 Remaining backups:"
/home/jon/Nexus/infrastructure/scripts/list-backups.sh
