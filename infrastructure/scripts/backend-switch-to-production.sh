#!/bin/bash
# Restart Production Backend Instance
# In dual-instance setup, this restarts signhouse-backend on port 3001

set -e

BACKEND_DIR="/home/jon/Nexus/backend/web"

echo "🔄 Restarting PRODUCTION backend..."
echo ""

# Check if production build exists
if [ ! -d "$BACKEND_DIR/dist-production" ]; then
    echo "❌ Production build not found!"
    echo "   Run backend-rebuild-production.sh first"
    exit 1
fi

# Restart PM2 production instance
echo "🔄 Restarting signhouse-backend (port 3001)..."
pm2 restart signhouse-backend

echo ""
echo "✅ Production backend restarted!"
echo ""
echo "📋 Check logs: pm2 logs signhouse-backend --lines 20"
echo "🌐 Production API: http://192.168.2.14:3001"
