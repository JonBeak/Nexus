#!/bin/bash
# List all build backups

echo "💾 Build Backups"
echo "================"
echo ""

# Backend backups
echo "🔧 BACKEND BACKUPS (/infrastructure/backups/backend-builds/)"
if [ -d "/home/jon/Nexus/infrastructure/backups/backend-builds" ]; then
    BACKEND_COUNT=$(ls -1 /home/jon/Nexus/infrastructure/backups/backend-builds/*.tar.gz 2>/dev/null | wc -l)
    BACKEND_TOTAL=$(du -sh /home/jon/Nexus/infrastructure/backups/backend-builds/ 2>/dev/null | cut -f1)
    echo "   Total: $BACKEND_COUNT backups ($BACKEND_TOTAL)"
    echo ""
    echo "   Recent backups:"
    ls -lth /home/jon/Nexus/infrastructure/backups/backend-builds/*.tar.gz 2>/dev/null | head -10 | awk '{print "     " $9 " - " $5 " (" $6 " " $7 " " $8 ")"}'
else
    echo "   No backups found"
fi

echo ""
echo "🌐 FRONTEND BACKUPS (/infrastructure/backups/frontend-builds/)"
if [ -d "/home/jon/Nexus/infrastructure/backups/frontend-builds" ]; then
    FRONTEND_COUNT=$(ls -1 /home/jon/Nexus/infrastructure/backups/frontend-builds/*.tar.gz 2>/dev/null | wc -l)
    FRONTEND_TOTAL=$(du -sh /home/jon/Nexus/infrastructure/backups/frontend-builds/ 2>/dev/null | cut -f1)
    echo "   Total: $FRONTEND_COUNT backups ($FRONTEND_TOTAL)"
    echo ""
    echo "   Recent backups:"
    ls -lth /home/jon/Nexus/infrastructure/backups/frontend-builds/*.tar.gz 2>/dev/null | head -10 | awk '{print "     " $9 " - " $5 " (" $6 " " $7 " " $8 ")"}'
else
    echo "   No backups found"
fi

echo ""
