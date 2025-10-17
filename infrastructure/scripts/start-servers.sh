#!/bin/bash
# Sign House - Start both servers in background

set -e

REPO_DIR="/home/jon/Nexus"

echo "🚀 Starting Sign House servers..."

# Kill existing processes if any
echo "🔍 Stopping any existing servers..."

# Kill by PID if available
if [ -f /tmp/signhouse-backend.pid ]; then
    BACKEND_PID=$(cat /tmp/signhouse-backend.pid)
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "   Stopping backend (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" || true
    fi
    rm -f /tmp/signhouse-backend.pid
fi

if [ -f /tmp/signhouse-frontend.pid ]; then
    FRONTEND_PID=$(cat /tmp/signhouse-frontend.pid)
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo "   Stopping frontend (PID: $FRONTEND_PID)..."
        kill "$FRONTEND_PID" || true
    fi
    rm -f /tmp/signhouse-frontend.pid
fi

# Kill any remaining processes
pkill -f "npm run dev" || true
pkill -f "npx vite" || true

# Kill processes using our ports
# Backend port 3001
BACKEND_PORT_PIDS=$(lsof -ti :3001 2>/dev/null || true)
if [ -n "$BACKEND_PORT_PIDS" ]; then
    echo "   Killing processes on port 3001: $BACKEND_PORT_PIDS"
    echo "$BACKEND_PORT_PIDS" | xargs kill -9 2>/dev/null || true
fi

# Frontend port 5173
FRONTEND_PORT_PIDS=$(lsof -ti :5173 2>/dev/null || true)
if [ -n "$FRONTEND_PORT_PIDS" ]; then
    echo "   Killing processes on port 5173: $FRONTEND_PORT_PIDS"
    echo "$FRONTEND_PORT_PIDS" | xargs kill -9 2>/dev/null || true
fi

# Wait a moment for processes to terminate
sleep 2

# Start backend server
echo "🔧 Starting backend server..."
cd "$REPO_DIR/backend/web"
nohup npm run dev > /tmp/signhouse-backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Start frontend server  
echo "🌐 Starting frontend server..."
cd "$REPO_DIR/frontend/web"
nohup npx vite --host > /tmp/signhouse-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

# Save PIDs for later management
echo "$BACKEND_PID" > /tmp/signhouse-backend.pid
echo "$FRONTEND_PID" > /tmp/signhouse-frontend.pid

echo ""
echo "✅ Sign House servers started!"
echo "📊 Status:"
echo "   Backend:  http://192.168.2.14:3001 (PID: $BACKEND_PID)"
echo "   Frontend: http://192.168.2.14:5173 (PID: $FRONTEND_PID)"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f /tmp/signhouse-backend.log"
echo "   Frontend: tail -f /tmp/signhouse-frontend.log"
echo ""
echo "🛑 To stop: $REPO_DIR/infrastructure/scripts/stop-servers.sh"