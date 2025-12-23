#!/bin/bash
# Rebuild BOTH Backend and Frontend PRODUCTION builds

set -e

echo "🔨 Rebuilding PRODUCTION builds for Backend + Frontend..."
echo ""

# Backend
echo "📦 Backend..."
/home/jon/Nexus/infrastructure/scripts/backend-rebuild-production.sh
echo ""

# Frontend
echo "📦 Frontend..."
/home/jon/Nexus/infrastructure/scripts/frontend-rebuild-production.sh
echo ""

echo "✅ Both PRODUCTION builds rebuilt and activated!"
echo ""
echo "   Backend: port 3001 (signhouse-backend)"
echo "   Frontend: Nginx (nexuswebapp.duckdns.org)"
