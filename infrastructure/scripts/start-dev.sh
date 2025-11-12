#!/bin/bash
# Sign House - Start PURE DEVELOPMENT servers (both with hot reload)
# No PM2, no builds - just rapid development iteration

set -e

REPO_DIR="/home/jon/Nexus"

echo "🚀 Starting Sign House in PURE DEV MODE..."
echo "   (Backend: nodemon + tsx hot reload)"
echo "   (Frontend: Vite dev server hot reload)"
echo ""

# Stop existing dev servers if running
echo "🧹 Cleaning up any existing dev servers..."

# Stop backend dev
if [ -f /tmp/signhouse-backend-dev.pid ]; then
    BACKEND_PID=$(cat /tmp/signhouse-backend-dev.pid)
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "   Stopping existing backend dev server (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" || true
    fi
    rm -f /tmp/signhouse-backend-dev.pid
fi

# Kill any nodemon/tsx processes
pkill -f "nodemon.*tsx.*server.ts" || true
pkill -f "tsx src/server.ts" || true

# Stop frontend dev
if [ -f /tmp/signhouse-frontend-dev.pid ]; then
    FRONTEND_PID=$(cat /tmp/signhouse-frontend-dev.pid)
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo "   Stopping existing frontend dev server (PID: $FRONTEND_PID)..."
        kill "$FRONTEND_PID" || true
    fi
    rm -f /tmp/signhouse-frontend-dev.pid
fi

# Kill any vite processes
pkill -f "npx vite" || true

# Check ports
BACKEND_PORT_PIDS=$(lsof -ti :3001 2>/dev/null || true)
if [ -n "$BACKEND_PORT_PIDS" ]; then
    echo "   ⚠️  Port 3001 is occupied. Clearing..."
    echo "$BACKEND_PORT_PIDS" | xargs kill -9 2>/dev/null || true
fi

FRONTEND_PORT_PIDS=$(lsof -ti :5173 2>/dev/null || true)
if [ -n "$FRONTEND_PORT_PIDS" ]; then
    echo "   ⚠️  Port 5173 is occupied. Clearing..."
    echo "$FRONTEND_PORT_PIDS" | xargs kill -9 2>/dev/null || true
fi

sleep 2

echo ""
echo "🔧 Starting Backend (nodemon + tsx with hot reload)..."
cd "$REPO_DIR/backend/web"
nohup npm run dev > /tmp/signhouse-backend-dev.log 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > /tmp/signhouse-backend-dev.pid
echo "   ✓ Backend dev server running on port 3001 (PID: $BACKEND_PID)"

sleep 2

echo ""
echo "🌐 Starting Frontend (Vite dev server with hot reload)..."
cd "$REPO_DIR/frontend/web"
nohup npx vite --host > /tmp/signhouse-frontend-dev.log 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > /tmp/signhouse-frontend-dev.pid
echo "   ✓ Frontend dev server running on port 5173 (PID: $FRONTEND_PID)"

echo ""
echo "✅ Development servers started!"
echo ""
echo "📊 Access URLs:"
echo "   Frontend:     http://192.168.2.14:5173 (hot reload)"
echo "   Backend API:  http://192.168.2.14:3001 (hot reload)"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f /tmp/signhouse-backend-dev.log"
echo "   Frontend: tail -f /tmp/signhouse-frontend-dev.log"
echo ""
echo "📝 Features:"
echo "   ✓ Backend auto-restarts on TypeScript changes (nodemon)"
echo "   ✓ Frontend hot module replacement (Vite HMR)"
echo "   ✓ No build steps - instant updates"
echo "   ✓ Full TypeScript type checking in real-time"
echo ""
echo "🛑 To stop: $REPO_DIR/infrastructure/scripts/stop-dev.sh"
