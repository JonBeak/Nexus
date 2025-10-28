#!/bin/bash
# Sign House - Stop servers

set -e

echo "🛑 Stopping Sign House development servers..."

# Stop frontend dev server
if [ -f /tmp/signhouse-frontend.pid ]; then
    FRONTEND_PID=$(cat /tmp/signhouse-frontend.pid)
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo "   Stopping frontend dev server (PID: $FRONTEND_PID)..."
        kill "$FRONTEND_PID" || true
    fi
    rm -f /tmp/signhouse-frontend.pid
fi

# Kill any remaining frontend processes
pkill -f "npx vite" || true

# Frontend port 5173
FRONTEND_PORT_PIDS=$(lsof -ti :5173 2>/dev/null || true)
if [ -n "$FRONTEND_PORT_PIDS" ]; then
    echo "   Killing processes on port 5173: $FRONTEND_PORT_PIDS"
    echo "$FRONTEND_PORT_PIDS" | xargs kill -9 2>/dev/null || true
fi

echo ""
echo "✅ Frontend dev server stopped!"
echo ""
echo "ℹ️  Note: Backend is managed by PM2 and continues running for production."
echo "   To stop backend: pm2 stop signhouse-backend"
echo "   To restart backend: pm2 restart signhouse-backend"