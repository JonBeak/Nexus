#!/bin/bash
# Sign House - Start both servers in background

set -e

REPO_DIR="/home/jon/Nexus"

echo "🚀 Starting Sign House servers..."

# Kill existing processes if any
echo "🔍 Stopping any existing servers..."
pkill -f "npm run dev" || true
pkill -f "npx vite" || true

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