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

echo "✅ Both DEV builds rebuilt successfully!"
echo ""
echo "🔄 To activate, run: switch-to-dev.sh"
