#!/bin/bash
# Restore a build from backup

if [ -z "$1" ]; then
    echo "❌ Usage: restore-backup.sh <backup-file>"
    echo ""
    echo "📋 Available backups:"
    echo ""
    echo "🔧 Backend:"
    ls -1 /home/jon/Nexus/infrastructure/backups/backend-builds/*.tar.gz 2>/dev/null | tail -5 | xargs -n1 basename
    echo ""
    echo "🌐 Frontend:"
    ls -1 /home/jon/Nexus/infrastructure/backups/frontend-builds/*.tar.gz 2>/dev/null | tail -5 | xargs -n1 basename
    exit 1
fi

BACKUP_FILE="$1"

# Determine if backend or frontend
if [[ "$BACKUP_FILE" == *"backend"* ]] || [ -f "/home/jon/Nexus/infrastructure/backups/backend-builds/$BACKUP_FILE" ]; then
    TYPE="backend"
    BACKUP_PATH="/home/jon/Nexus/infrastructure/backups/backend-builds/$BACKUP_FILE"
    TARGET_DIR="/home/jon/Nexus/backend/web"
elif [[ "$BACKUP_FILE" == *"frontend"* ]] || [ -f "/home/jon/Nexus/infrastructure/backups/frontend-builds/$BACKUP_FILE" ]; then
    TYPE="frontend"
    BACKUP_PATH="/home/jon/Nexus/infrastructure/backups/frontend-builds/$BACKUP_FILE"
    TARGET_DIR="/home/jon/Nexus/frontend/web"
else
    echo "❌ Backup file not found"
    exit 1
fi

# Extract build type from filename
if [[ "$BACKUP_FILE" == *"production"* ]]; then
    BUILD_TYPE="production"
elif [[ "$BACKUP_FILE" == *"dev"* ]]; then
    BUILD_TYPE="dev"
else
    echo "❌ Cannot determine build type from filename"
    exit 1
fi

echo "🔄 Restoring $TYPE $BUILD_TYPE build..."
echo "   From: $BACKUP_FILE"
echo ""

# Confirm
read -p "⚠️  This will overwrite the current dist-$BUILD_TYPE directory. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Restore cancelled"
    exit 1
fi

# Create safety backup of current build
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
if [ -d "$TARGET_DIR/dist-$BUILD_TYPE" ]; then
    echo "📁 Creating safety backup of current build..."
    cd "$TARGET_DIR"
    tar -czf "$TARGET_DIR/dist-$BUILD_TYPE-pre-restore-$TIMESTAMP.tar.gz" "dist-$BUILD_TYPE/"
    rm -rf "dist-$BUILD_TYPE"
fi

# Extract backup
echo "📦 Extracting backup..."
cd "$TARGET_DIR"
tar -xzf "$BACKUP_PATH"

# Verify
if [ -d "$TARGET_DIR/dist-$BUILD_TYPE" ]; then
    echo "✅ Restore successful!"
    echo ""
    echo "📋 Next steps:"
    if [ "$TYPE" = "backend" ]; then
        if [ "$BUILD_TYPE" = "production" ]; then
            echo "   Activate: pm2 restart signhouse-backend"
        else
            echo "   Activate: pm2 restart signhouse-backend-dev"
        fi
    else
        if [ "$BUILD_TYPE" = "production" ]; then
            echo "   Nginx automatically serves the restored build"
        else
            echo "   ⚠️  Note: Frontend dev uses Vite which serves from source, not dist-dev."
            echo "   This restore has no effect on the running dev server."
        fi
    fi
else
    echo "❌ Restore failed - directory not created"
    exit 1
fi
