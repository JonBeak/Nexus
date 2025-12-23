#!/bin/bash
# Start Sign House System - Development Mode
# Starts both backend instances + frontend dev server
# Dev frontend (5173) talks to dev backend (3002)

set -e

REPO_DIR="/home/jon/Nexus"

echo "🚀 Starting Sign House (DEV MODE)..."
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

# Start frontend dev server
echo "🌐 Starting frontend dev server..."

# Stop existing frontend if running
if [ -f /tmp/signhouse-frontend.pid ]; then
    FRONTEND_PID=$(cat /tmp/signhouse-frontend.pid)
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo "   Stopping existing frontend (PID: $FRONTEND_PID)..."
        kill "$FRONTEND_PID" || true
    fi
    rm -f /tmp/signhouse-frontend.pid
fi

# Kill any remaining frontend processes
pkill -f "npx vite" || true
FRONTEND_PORT_PIDS=$(lsof -ti :5173 2>/dev/null || true)
if [ -n "$FRONTEND_PORT_PIDS" ]; then
    echo "   Killing processes on port 5173: $FRONTEND_PORT_PIDS"
    echo "$FRONTEND_PORT_PIDS" | xargs kill -9 2>/dev/null || true
fi

sleep 1

cd "$REPO_DIR/frontend/web"
nohup npx vite --host > /tmp/signhouse-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > /tmp/signhouse-frontend.pid
echo "   ✓ Frontend dev server running on port 5173 (PID: $FRONTEND_PID)"

echo ""
echo "✅ Sign House started in DEV MODE!"
echo ""
echo "📊 Access URLs:"
echo "   DEV Frontend:   http://192.168.2.14:5173 (hot reload, talks to port 3002)"
echo "   PROD Frontend:  https://nexuswebapp.duckdns.org (talks to port 3001)"
echo ""
echo "🔧 Backend Instances:"
echo "   Production: http://192.168.2.14:3001 (dist-production)"
echo "   Development: http://192.168.2.14:3002 (dist-dev)"
echo ""
echo "📋 Logs:"
echo "   Backend Prod:  pm2 logs signhouse-backend"
echo "   Backend Dev:   pm2 logs signhouse-backend-dev"
echo "   Frontend:      tail -f /tmp/signhouse-frontend.log"
echo ""
echo "🛑 To stop: /home/jon/Nexus/infrastructure/scripts/stop-servers.sh"
