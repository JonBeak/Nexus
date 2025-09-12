#!/bin/bash
# Sign House - Check server status

echo "📊 Sign House Server Status"
echo "============================"

# Check backend
echo "🔧 Backend Server:"
if pgrep -f "npm run dev" > /dev/null; then
    BACKEND_PID=$(pgrep -f "npm run dev")
    echo "   ✅ Running (PID: $BACKEND_PID)"
    echo "   🌐 URL: http://192.168.2.14:3001"
    if curl -s http://192.168.2.14:3001/api/health > /dev/null; then
        echo "   💚 Health check: PASSED"
    else
        echo "   ⚠️  Health check: FAILED"
    fi
else
    echo "   ❌ Not running"
fi

echo ""

# Check frontend  
echo "🌐 Frontend Server:"
if pgrep -f "npx vite" > /dev/null; then
    FRONTEND_PID=$(pgrep -f "npx vite")
    echo "   ✅ Running (PID: $FRONTEND_PID)"
    echo "   🌐 URL: http://192.168.2.14:5173"
    if curl -s http://192.168.2.14:5173 > /dev/null; then
        echo "   💚 Health check: PASSED"
    else
        echo "   ⚠️  Health check: FAILED"
    fi
else
    echo "   ❌ Not running"
fi

echo ""
echo "📋 Recent Logs:"
if [ -f /tmp/signhouse-backend.log ]; then
    echo "   Backend: tail -f /tmp/signhouse-backend.log"
fi
if [ -f /tmp/signhouse-frontend.log ]; then
    echo "   Frontend: tail -f /tmp/signhouse-frontend.log"
fi