#!/bin/bash
# Environment Detection Script for SignHouse
# Detects OS, paths, and available tools

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
        echo "windows"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

# Detect if running in Git Bash on Windows
detect_shell() {
    if [[ -n "$MSYSTEM" ]]; then
        echo "git-bash"
    elif [[ "$SHELL" == *"bash"* ]]; then
        echo "bash"
    elif [[ "$SHELL" == *"zsh"* ]]; then
        echo "zsh"
    else
        echo "unknown"
    fi
}

# Find project root directory
find_project_root() {
    local current_dir="$PWD"
    local root_dir="$current_dir"

    # Look for key project files
    while [[ "$root_dir" != "/" && "$root_dir" != "" ]]; do
        if [[ -f "$root_dir/CLAUDE.md" && -d "$root_dir/backend" && -d "$root_dir/frontend" ]]; then
            echo "$root_dir"
            return 0
        fi
        root_dir=$(dirname "$root_dir")
    done

    # If not found, assume current directory
    echo "$current_dir"
}

# Detect Node.js and npm
detect_node() {
    if command -v node &> /dev/null; then
        echo "$(node --version)"
    else
        echo "not-found"
    fi
}

detect_npm() {
    if command -v npm &> /dev/null; then
        echo "$(npm --version)"
    else
        echo "not-found"
    fi
}

# Detect MySQL
detect_mysql() {
    local os="$1"

    if [[ "$os" == "windows" ]]; then
        # Check common Windows MySQL paths
        if [[ -f "/c/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe" ]]; then
            echo "/c/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe"
        elif [[ -f "C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe" ]]; then
            echo "C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe"
        elif command -v mysql &> /dev/null; then
            echo "$(command -v mysql)"
        else
            echo "not-found"
        fi
    else
        if command -v mysql &> /dev/null; then
            echo "$(command -v mysql)"
        else
            echo "not-found"
        fi
    fi
}

# Check if ports are available
check_port() {
    local port="$1"
    local os="$2"

    if [[ "$os" == "windows" ]]; then
        # Windows netstat command
        if netstat -an 2>/dev/null | grep -q ":${port} "; then
            echo "in-use"
        else
            echo "available"
        fi
    else
        # Linux/Mac netstat or ss command
        if command -v netstat &> /dev/null; then
            if netstat -tuln 2>/dev/null | grep -q ":${port} "; then
                echo "in-use"
            else
                echo "available"
            fi
        elif command -v ss &> /dev/null; then
            if ss -tuln 2>/dev/null | grep -q ":${port}"; then
                echo "in-use"
            else
                echo "available"
            fi
        else
            echo "unknown"
        fi
    fi
}

# Main detection function
main() {
    echo -e "${BLUE}🔍 SignHouse Environment Detection${NC}"
    echo "=================================="

    # Basic environment
    OS=$(detect_os)
    SHELL_TYPE=$(detect_shell)
    PROJECT_ROOT=$(find_project_root)

    echo -e "${GREEN}Operating System:${NC} $OS"
    echo -e "${GREEN}Shell:${NC} $SHELL_TYPE"
    echo -e "${GREEN}Project Root:${NC} $PROJECT_ROOT"

    # Node.js environment
    echo ""
    echo -e "${BLUE}Node.js Environment${NC}"
    echo "==================="

    NODE_VERSION=$(detect_node)
    NPM_VERSION=$(detect_npm)

    if [[ "$NODE_VERSION" == "not-found" ]]; then
        echo -e "${RED}❌ Node.js: Not found${NC}"
    else
        echo -e "${GREEN}✅ Node.js:${NC} $NODE_VERSION"
    fi

    if [[ "$NPM_VERSION" == "not-found" ]]; then
        echo -e "${RED}❌ npm: Not found${NC}"
    else
        echo -e "${GREEN}✅ npm:${NC} $NPM_VERSION"
    fi

    # MySQL
    echo ""
    echo -e "${BLUE}Database${NC}"
    echo "========"

    MYSQL_PATH=$(detect_mysql "$OS")
    if [[ "$MYSQL_PATH" == "not-found" ]]; then
        echo -e "${RED}❌ MySQL: Not found${NC}"
    else
        echo -e "${GREEN}✅ MySQL:${NC} $MYSQL_PATH"
    fi

    # Port availability
    echo ""
    echo -e "${BLUE}Port Availability${NC}"
    echo "================="

    BACKEND_PORT=$(check_port 3001 "$OS")
    FRONTEND_PORT=$(check_port 5173 "$OS")

    if [[ "$BACKEND_PORT" == "available" ]]; then
        echo -e "${GREEN}✅ Port 3001 (Backend):${NC} Available"
    elif [[ "$BACKEND_PORT" == "in-use" ]]; then
        echo -e "${YELLOW}⚠️  Port 3001 (Backend):${NC} In use"
    else
        echo -e "${RED}❓ Port 3001 (Backend):${NC} Unknown"
    fi

    if [[ "$FRONTEND_PORT" == "available" ]]; then
        echo -e "${GREEN}✅ Port 5173 (Frontend):${NC} Available"
    elif [[ "$FRONTEND_PORT" == "in-use" ]]; then
        echo -e "${YELLOW}⚠️  Port 5173 (Frontend):${NC} In use"
    else
        echo -e "${RED}❓ Port 5173 (Frontend):${NC} Unknown"
    fi

    # Project structure
    echo ""
    echo -e "${BLUE}Project Structure${NC}"
    echo "================="

    BACKEND_EXISTS="❌"
    FRONTEND_EXISTS="❌"
    ENV_BACKEND="❌"
    ENV_FRONTEND="❌"

    if [[ -d "$PROJECT_ROOT/backend/web" ]]; then
        BACKEND_EXISTS="✅"
    fi

    if [[ -d "$PROJECT_ROOT/frontend/web" ]]; then
        FRONTEND_EXISTS="✅"
    fi

    if [[ -f "$PROJECT_ROOT/backend/web/.env" ]]; then
        ENV_BACKEND="✅"
    fi

    if [[ -f "$PROJECT_ROOT/frontend/web/.env" ]]; then
        ENV_FRONTEND="✅"
    fi

    echo -e "$BACKEND_EXISTS Backend directory: $PROJECT_ROOT/backend/web"
    echo -e "$FRONTEND_EXISTS Frontend directory: $PROJECT_ROOT/frontend/web"
    echo -e "$ENV_BACKEND Backend .env file"
    echo -e "$ENV_FRONTEND Frontend .env file"

    # Export environment variables for other scripts
    export SIGNHOUSE_OS="$OS"
    export SIGNHOUSE_SHELL="$SHELL_TYPE"
    export SIGNHOUSE_ROOT="$PROJECT_ROOT"
    export SIGNHOUSE_MYSQL="$MYSQL_PATH"
    export SIGNHOUSE_NODE="$NODE_VERSION"
    export SIGNHOUSE_NPM="$NPM_VERSION"
    export SIGNHOUSE_BACKEND_PORT="$BACKEND_PORT"
    export SIGNHOUSE_FRONTEND_PORT="$FRONTEND_PORT"

    echo ""
    echo -e "${GREEN}Environment variables exported for use in other scripts.${NC}"
}

# Run main function
main "$@"