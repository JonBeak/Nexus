#!/bin/bash
# Restart Dev Backend Instance
# In dual-instance setup, this restarts signhouse-backend-dev on port 3002

set -e

BACKEND_DIR="/home/jon/Nexus/backend/web"

echo "🔄 Restarting DEV backend..."
echo ""

# Check if dev build exists
if [ ! -d "$BACKEND_DIR/dist-dev" ]; then
    echo "❌ Dev build not found!"
    echo "   Run backend-rebuild-dev.sh first"
    exit 1
fi

# Restart PM2 dev instance
echo "🔄 Restarting signhouse-backend-dev (port 3002)..."
pm2 restart signhouse-backend-dev

echo ""
echo "✅ Dev backend restarted!"
echo ""
echo "📋 Check logs: pm2 logs signhouse-backend-dev --lines 20"
echo "🌐 Dev API: http://192.168.2.14:3002"
