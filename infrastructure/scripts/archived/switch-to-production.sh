#!/bin/bash
# Switch BOTH Backend and Frontend to PRODUCTION builds

set -e

echo "🔄 Switching to PRODUCTION builds..."
echo ""

# Backend
echo "🔧 Backend..."
/home/jon/Nexus/infrastructure/scripts/backend-switch-to-production.sh
echo ""

# Frontend
echo "🌐 Frontend..."
/home/jon/Nexus/infrastructure/scripts/frontend-switch-to-production.sh
echo ""

echo "✅ Both services now running PRODUCTION builds!"
echo ""
echo "📋 Check status: pm2 status"
