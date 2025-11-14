#!/bin/bash
# Sign House - Check server status

echo "📊 Sign House Server Status"
echo "============================"
echo ""

# Check backend (PM2)
echo "🔧 Backend Server (PM2):"
if pm2 list | grep -q "signhouse-backend"; then
    STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="signhouse-backend") | .pm2_env.status' 2>/dev/null)
    if [ "$STATUS" == "online" ]; then
        echo "   ✅ Running (PM2)"
        echo "   🌐 URL: http://192.168.2.14:3001"

        # Check which build is active
        BACKEND_DIR="/home/jon/Nexus/backend/web"
        if [ -L "$BACKEND_DIR/dist" ]; then
            ACTIVE_BUILD=$(readlink "$BACKEND_DIR/dist")
            if [ "$ACTIVE_BUILD" == "dist-production" ]; then
                echo "   🏗️  Build: PRODUCTION (commit 8c2a637)"
            elif [ "$ACTIVE_BUILD" == "dist-dev" ]; then
                echo "   🏗️  Build: DEVELOPMENT (latest code)"
            else
                echo "   🏗️  Build: $ACTIVE_BUILD"
            fi
        else
            echo "   ⚠️  Build: Unknown (dist is not a symlink)"
        fi

        if curl -s http://192.168.2.14:3001/api/health > /dev/null 2>&1; then
            echo "   💚 Health check: PASSED"
        else
            echo "   ⚠️  Health check: FAILED (or no health endpoint)"
        fi
    else
        echo "   ⚠️  Status: $STATUS"
    fi
else
    echo "   ❌ Not running in PM2"
fi

echo ""

# Check frontend dev server
echo "🌐 Frontend Dev Server:"
if pgrep -f "npx vite" > /dev/null; then
    FRONTEND_PID=$(pgrep -f "npx vite")
    echo "   ✅ Running (PID: $FRONTEND_PID)"
    echo "   🌐 URL: http://192.168.2.14:5173"
    if curl -s http://192.168.2.14:5173 > /dev/null 2>&1; then
        echo "   💚 Health check: PASSED"
    else
        echo "   ⚠️  Health check: FAILED"
    fi
else
    echo "   ❌ Not running"
fi

echo ""

# Check Nginx
echo "🌍 Nginx (Production):"
if systemctl is-active --quiet nginx; then
    echo "   ✅ Running"
    echo "   🌐 Production URL: https://nexuswebapp.duckdns.org"
else
    echo "   ❌ Not running"
fi

echo ""

# Check MySQL
echo "💾 MySQL Database:"
if systemctl is-active --quiet mysql; then
    echo "   ✅ Running"
else
    echo "   ❌ Not running"
fi

echo ""
echo "📋 Logs:"
echo "   Backend (PM2):  pm2 logs signhouse-backend"
if [ -f /tmp/signhouse-frontend.log ]; then
    echo "   Frontend (Dev): tail -f /tmp/signhouse-frontend.log"
fi
echo "   Nginx:          sudo tail -f /var/log/nginx/signhouse-error.log"
echo ""
echo "🔍 Quick Commands:"
echo "   PM2 status:     pm2 status"
echo "   PM2 restart:    pm2 restart signhouse-backend"
echo "   PM2 logs:       pm2 logs signhouse-backend"