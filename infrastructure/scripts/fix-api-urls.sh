#!/bin/bash
# Fix hardcoded API URLs in frontend code

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔧 Fixing hardcoded API URLs in frontend...${NC}"

# Find project root
if [[ -f "CLAUDE.md" ]]; then
    PROJECT_ROOT="$PWD"
elif [[ -f "../CLAUDE.md" ]]; then
    PROJECT_ROOT="$(cd .. && pwd)"
elif [[ -f "../../CLAUDE.md" ]]; then
    PROJECT_ROOT="$(cd ../.. && pwd)"
else
    echo "❌ Could not find project root (CLAUDE.md not found)"
    exit 1
fi

FRONTEND_SRC="$PROJECT_ROOT/frontend/web/src"

if [[ ! -d "$FRONTEND_SRC" ]]; then
    echo "❌ Frontend source directory not found: $FRONTEND_SRC"
    exit 1
fi

# Replace hardcoded URLs with environment variable
find "$FRONTEND_SRC" -name "*.ts" -o -name "*.tsx" | while read -r file; do
    if grep -q "http://192\.168\.2\.14:3001" "$file"; then
        echo "🔄 Fixing: $file"

        # Use different approaches for different OSes
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' 's|http://192\.168\.2\.14:3001/api|\${import.meta.env.VITE_API_URL \|\| '\''http://localhost:3001/api'\''}|g' "$file"
        elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
            # Windows Git Bash
            sed -i 's|http://192\.168\.2\.14:3001/api|${import.meta.env.VITE_API_URL || '\''http://localhost:3001/api'\''}|g' "$file"
        else
            # Linux
            sed -i 's|http://192\.168\.2\.14:3001/api|${import.meta.env.VITE_API_URL || '\''http://localhost:3001/api'\''}|g' "$file"
        fi
    fi
done

echo -e "${GREEN}✅ API URL fixing complete!${NC}"
echo -e "${YELLOW}💡 You may need to restart the frontend server for changes to take effect.${NC}"