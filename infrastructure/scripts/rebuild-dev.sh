#!/bin/bash
# Rebuild BOTH Backend and Frontend DEV builds

set -e

echo "🔨 Rebuilding DEV builds for Backend + Frontend..."
echo ""

# Backend
echo "📦 Backend..."
/home/jon/Nexus/infrastructure/scripts/backend-rebuild-dev.sh
echo ""

# Frontend
echo "📦 Frontend..."
/home/jon/Nexus/infrastructure/scripts/frontend-rebuild-dev.sh
echo ""

echo "✅ Both DEV builds rebuilt and activated!"
echo ""
echo "   Backend: port 3002 (signhouse-backend-dev)"
echo "   Frontend: port 5173 (Vite dev server)"
