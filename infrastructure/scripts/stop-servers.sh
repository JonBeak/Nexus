#!/bin/bash
# Sign House - Stop servers

set -e

echo "🛑 Stopping Sign House servers..."

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
echo "🔍 Cleaning up any remaining processes..."
pkill -f "npm run dev" || true
pkill -f "npx vite" || true

# Kill processes using our ports
echo "🔍 Checking for processes using ports 3001 and 5173..."

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

echo "✅ Sign House servers stopped!"