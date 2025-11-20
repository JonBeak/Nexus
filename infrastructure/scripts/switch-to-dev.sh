#!/bin/bash
# Switch BOTH Backend and Frontend to DEV builds

set -e

echo "🔄 Switching to DEV builds..."
echo ""

# Backend
echo "🔧 Backend..."
/home/jon/Nexus/infrastructure/scripts/backend-switch-to-dev.sh
echo ""

# Frontend  
echo "🌐 Frontend..."
/home/jon/Nexus/infrastructure/scripts/frontend-switch-to-dev.sh
echo ""

echo "✅ Both services now running DEV builds!"
echo ""
echo "📋 Check status: pm2 status"
