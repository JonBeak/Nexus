#!/bin/bash
# Show current build status for Backend and Frontend

echo "📊 Build Status Report"
echo "====================="
echo ""

# Backend
echo "🔧 BACKEND (/home/jon/Nexus/backend/web/)"
echo "   Active: $(readlink /home/jon/Nexus/backend/web/dist)"
echo "   Builds available:"
ls -lh /home/jon/Nexus/backend/web/ | grep "^d.*dist-" | awk '{print "     - " $9 " (" $5 ")"}'
echo ""

# Frontend
echo "🌐 FRONTEND (/home/jon/Nexus/frontend/web/)"
echo "   Active: $(readlink /home/jon/Nexus/frontend/web/dist)"
echo "   Builds available:"
ls -lh /home/jon/Nexus/frontend/web/ | grep "^d.*dist-" | awk '{print "     - " $9 " (" $5 ")"}'
echo ""

# Git info
echo "📝 Current Commit: $(git rev-parse --short HEAD) - $(git log -1 --pretty=%B | head -1)"
echo ""

# PM2 Status
echo "🚀 PM2 Backend Status:"
pm2 status | grep signhouse-backend
echo ""

# Backups
echo "💾 Recent Backups:"
echo "   Backend: $(ls -1t /home/jon/Nexus/infrastructure/backups/backend-builds/ | head -3 | tr '\n' ', ' | sed 's/,$//')"
echo "   Frontend: $(ls -1t /home/jon/Nexus/infrastructure/backups/frontend-builds/ | head -3 | tr '\n' ', ' | sed 's/,$//')"
