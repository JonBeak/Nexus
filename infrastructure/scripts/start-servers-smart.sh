#!/bin/bash
# Smart Cross-Platform Server Starter for SignHouse
# Automatically detects environment and starts servers appropriately

# Source environment detection
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/detect-environment.sh" >/dev/null 2>&1

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Process management functions
kill_process_on_port() {
    local port="$1"
    local os="$2"

    echo -e "${YELLOW}🔍 Checking for processes on port $port...${NC}"

    if [[ "$os" == "windows" ]]; then
        # Windows process killing
        local pid=$(netstat -ano 2>/dev/null | grep ":$port " | awk '{print $5}' | head -1)
        if [[ -n "$pid" && "$pid" != "0" ]]; then
            echo -e "${YELLOW}⚠️  Killing process $pid on port $port${NC}"
            powershell -Command "Stop-Process -Id $pid -Force" 2>/dev/null || {
                echo -e "${RED}❌ Failed to kill process $pid${NC}"
                return 1
            }
            sleep 2
        fi
    else
        # Linux/Mac process killing
        local pid=$(lsof -ti:$port 2>/dev/null)
        if [[ -n "$pid" ]]; then
            echo -e "${YELLOW}⚠️  Killing process $pid on port $port${NC}"
            kill -9 "$pid" 2>/dev/null || {
                echo -e "${RED}❌ Failed to kill process $pid${NC}"
                return 1
            }
            sleep 2
        fi
    fi
}

# Start backend server
start_backend() {
    echo -e "${BLUE}🚀 Starting Backend Server${NC}"
    echo "========================="

    if [[ ! -d "$SIGNHOUSE_ROOT/backend/web" ]]; then
        echo -e "${RED}❌ Backend directory not found: $SIGNHOUSE_ROOT/backend/web${NC}"
        return 1
    fi

    # Check if node_modules exists
    if [[ ! -d "$SIGNHOUSE_ROOT/backend/web/node_modules" ]]; then
        echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
        cd "$SIGNHOUSE_ROOT/backend/web" && npm install
    fi

    # Check for .env file
    if [[ ! -f "$SIGNHOUSE_ROOT/backend/web/.env" ]]; then
        echo -e "${YELLOW}⚠️  No .env file found. Creating default...${NC}"
        create_backend_env
    fi

    # Kill any existing process on port 3001
    kill_process_on_port 3001 "$SIGNHOUSE_OS"

    echo -e "${GREEN}📍 Starting backend on port 3001...${NC}"
    cd "$SIGNHOUSE_ROOT/backend/web"

    if [[ "$SIGNHOUSE_OS" == "windows" ]]; then
        # Windows: Start in background and capture PID
        npm run dev > /tmp/signhouse-backend.log 2>&1 &
        echo $! > /tmp/signhouse-backend.pid
    else
        # Linux/Mac: Use nohup
        nohup npm run dev > /tmp/signhouse-backend.log 2>&1 &
        echo $! > /tmp/signhouse-backend.pid
    fi

    echo -e "${GREEN}✅ Backend started (PID: $(cat /tmp/signhouse-backend.pid))${NC}"
    sleep 3
}

# Start frontend server
start_frontend() {
    echo ""
    echo -e "${BLUE}🎨 Starting Frontend Server${NC}"
    echo "=========================="

    if [[ ! -d "$SIGNHOUSE_ROOT/frontend/web" ]]; then
        echo -e "${RED}❌ Frontend directory not found: $SIGNHOUSE_ROOT/frontend/web${NC}"
        return 1
    fi

    # Check if node_modules exists
    if [[ ! -d "$SIGNHOUSE_ROOT/frontend/web/node_modules" ]]; then
        echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
        cd "$SIGNHOUSE_ROOT/frontend/web" && npm install
    fi

    # Check/create .env file
    if [[ ! -f "$SIGNHOUSE_ROOT/frontend/web/.env" ]]; then
        echo -e "${YELLOW}⚠️  No frontend .env file found. Creating default...${NC}"
        create_frontend_env
    fi

    # Kill any existing process on port 5173
    kill_process_on_port 5173 "$SIGNHOUSE_OS"

    echo -e "${GREEN}📍 Starting frontend on port 5173...${NC}"
    cd "$SIGNHOUSE_ROOT/frontend/web"

    if [[ "$SIGNHOUSE_OS" == "windows" ]]; then
        # Windows: Start in background
        npm run dev > /tmp/signhouse-frontend.log 2>&1 &
        echo $! > /tmp/signhouse-frontend.pid
    else
        # Linux/Mac: Use nohup
        nohup npm run dev > /tmp/signhouse-frontend.log 2>&1 &
        echo $! > /tmp/signhouse-frontend.pid
    fi

    echo -e "${GREEN}✅ Frontend started (PID: $(cat /tmp/signhouse-frontend.pid))${NC}"
    sleep 3
}

# Create default backend .env
create_backend_env() {
    cat > "$SIGNHOUSE_ROOT/backend/web/.env" << 'EOF'
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=sign_manufacturing

# Server Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
EOF
    echo -e "${GREEN}✅ Created backend .env file${NC}"
}

# Create default frontend .env
create_frontend_env() {
    cat > "$SIGNHOUSE_ROOT/frontend/web/.env" << 'EOF'
VITE_API_URL=http://localhost:3001/api
EOF
    echo -e "${GREEN}✅ Created frontend .env file${NC}"
}

# Check MySQL connection
check_mysql() {
    echo -e "${BLUE}🗄️  Checking MySQL Connection${NC}"
    echo "============================="

    if [[ "$SIGNHOUSE_MYSQL" == "not-found" ]]; then
        echo -e "${RED}❌ MySQL not found. Please install MySQL first.${NC}"
        return 1
    fi

    # Test MySQL connection
    if [[ "$SIGNHOUSE_OS" == "windows" ]]; then
        if "$SIGNHOUSE_MYSQL" -u root -proot -e "SELECT 1;" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ MySQL connection successful${NC}"

            # Check if database exists
            if "$SIGNHOUSE_MYSQL" -u root -proot -e "USE sign_manufacturing; SELECT 1;" >/dev/null 2>&1; then
                echo -e "${GREEN}✅ Database 'sign_manufacturing' exists${NC}"
            else
                echo -e "${YELLOW}⚠️  Database 'sign_manufacturing' not found. Creating...${NC}"
                create_database
            fi
        else
            echo -e "${RED}❌ MySQL connection failed. Check credentials.${NC}"
            return 1
        fi
    else
        if mysql -u root -proot -e "SELECT 1;" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ MySQL connection successful${NC}"

            if mysql -u root -proot -e "USE sign_manufacturing; SELECT 1;" >/dev/null 2>&1; then
                echo -e "${GREEN}✅ Database 'sign_manufacturing' exists${NC}"
            else
                echo -e "${YELLOW}⚠️  Database 'sign_manufacturing' not found. Creating...${NC}"
                create_database
            fi
        else
            echo -e "${RED}❌ MySQL connection failed. Check credentials.${NC}"
            return 1
        fi
    fi
}

# Create database
create_database() {
    local schema_file="$SIGNHOUSE_ROOT/backend/database/create_database_first.sql"
    local legacy_schema="$SIGNHOUSE_ROOT/backend/database/archive/legacy_schemas/sign_manufacturing_schema.sql"

    if [[ -f "$legacy_schema" ]]; then
        echo -e "${GREEN}📂 Using legacy schema: $legacy_schema${NC}"
        if [[ "$SIGNHOUSE_OS" == "windows" ]]; then
            "$SIGNHOUSE_MYSQL" -u root -proot < "$legacy_schema"
        else
            mysql -u root -proot < "$legacy_schema"
        fi
        echo -e "${GREEN}✅ Database created successfully${NC}"
    elif [[ -f "$schema_file" ]]; then
        echo -e "${GREEN}📂 Using basic schema: $schema_file${NC}"
        if [[ "$SIGNHOUSE_OS" == "windows" ]]; then
            "$SIGNHOUSE_MYSQL" -u root -proot < "$schema_file"
        else
            mysql -u root -proot < "$schema_file"
        fi
    else
        echo -e "${YELLOW}⚠️  No schema files found. Database will be created on first run.${NC}"
    fi
}

# Main function
main() {
    echo -e "${CYAN}🏠 SignHouse Smart Server Starter${NC}"
    echo -e "${CYAN}==================================${NC}"
    echo ""

    # Check environment first
    if [[ -z "$SIGNHOUSE_OS" ]]; then
        echo -e "${RED}❌ Environment detection failed. Running detect-environment.sh first...${NC}"
        source "$SCRIPT_DIR/detect-environment.sh" >/dev/null 2>&1
    fi

    echo -e "${BLUE}Environment: $SIGNHOUSE_OS${NC}"
    echo -e "${BLUE}Project Root: $SIGNHOUSE_ROOT${NC}"
    echo ""

    # Check prerequisites
    if [[ "$SIGNHOUSE_NODE" == "not-found" ]]; then
        echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
        exit 1
    fi

    if [[ "$SIGNHOUSE_NPM" == "not-found" ]]; then
        echo -e "${RED}❌ npm not found. Please install npm first.${NC}"
        exit 1
    fi

    # Check MySQL (optional for development)
    check_mysql

    # Start servers
    echo ""
    start_backend
    start_frontend

    # Final status
    echo ""
    echo -e "${CYAN}🎉 Server Startup Complete!${NC}"
    echo -e "${CYAN}=========================${NC}"
    echo -e "${GREEN}✅ Backend: http://localhost:3001${NC}"
    echo -e "${GREEN}✅ Frontend: http://localhost:5173${NC}"
    echo ""
    echo -e "${YELLOW}💡 To check status: ./infrastructure/scripts/status-servers.sh${NC}"
    echo -e "${YELLOW}💡 To stop servers: ./infrastructure/scripts/stop-servers.sh${NC}"
    echo ""
    echo -e "${BLUE}📋 Logs:${NC}"
    echo -e "   Backend: /tmp/signhouse-backend.log"
    echo -e "   Frontend: /tmp/signhouse-frontend.log"
}

# Check if running directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi