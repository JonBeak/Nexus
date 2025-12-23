#!/bin/bash
# Start Sign House System - Production Mode
# Starts both backend instances (production remains primary)
# No frontend dev server - Nginx serves production build

set -e

REPO_DIR="/home/jon/Nexus"

echo "🚀 Starting Sign House (PRODUCTION MODE)..."
echo ""

# Start/restart both backend instances using ecosystem config
echo "🔧 Starting backend instances..."
cd "$REPO_DIR/backend/web"

# Check if PM2 instances exist
if pm2 describe signhouse-backend > /dev/null 2>&1; then
    echo "   Restarting existing PM2 instances..."
    pm2 restart ecosystem.config.js
else
    echo "   Starting PM2 instances from ecosystem config..."
    pm2 start ecosystem.config.js
fi
pm2 save

echo "   ✓ Backend instances running:"
echo "     - signhouse-backend (production) on port 3001"
echo "     - signhouse-backend-dev (dev) on port 3002"
echo ""

echo "✅ Sign House started in PRODUCTION MODE!"
echo ""
echo "📊 Access URLs:"
echo "   PROD Frontend:  https://nexuswebapp.duckdns.org (Nginx serves dist-production)"
echo "   DEV Frontend:   http://192.168.2.14:5173 (if dev server running)"
echo ""
echo "🔧 Backend Instances:"
echo "   Production: http://192.168.2.14:3001 (dist-production)"
echo "   Development: http://192.168.2.14:3002 (dist-dev)"
echo ""
echo "📋 Logs:"
echo "   Backend Prod:  pm2 logs signhouse-backend"
echo "   Backend Dev:   pm2 logs signhouse-backend-dev"
echo "   Nginx:         sudo tail -f /var/log/nginx/signhouse-error.log"
echo ""
echo "🛑 To stop: /home/jon/Nexus/infrastructure/scripts/stop-servers.sh"
