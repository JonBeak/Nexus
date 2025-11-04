#!/bin/bash
# Sign House - Start servers (PM2 for backend, dev server for frontend)

set -e

REPO_DIR="/home/jon/Nexus"

echo "🚀 Starting Sign House servers..."

# Build production frontend first
echo "📦 Building production frontend..."
cd "$REPO_DIR/frontend/web"
npm run build
echo "   ✓ Production build complete"

echo ""

# Backend - Build TypeScript and use PM2 (production-ready)
echo "🔧 Building backend..."
cd "$REPO_DIR/backend/web"
npm run build
echo "   ✓ Backend build complete"

echo "🔧 Starting/Restarting backend with PM2..."
pm2 restart signhouse-backend 2>/dev/null || pm2 start npm --name "signhouse-backend" -- start
echo "   ✓ Backend running on port 3001 (PM2)"

echo ""

# Frontend - Development server with hot reload
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
echo "✅ Sign House servers started!"
echo ""
echo "📊 Access URLs:"
echo "   Development:  http://192.168.2.14:5173 (hot reload)"
echo "   Production:   https://nexuswebapp.duckdns.org"
echo "   Backend API:  http://192.168.2.14:3001"
echo ""
echo "📋 Logs:"
echo "   Backend:  pm2 logs signhouse-backend"
echo "   Frontend: tail -f /tmp/signhouse-frontend.log"
echo ""
echo "🛑 To stop: $REPO_DIR/infrastructure/scripts/stop-servers.sh"