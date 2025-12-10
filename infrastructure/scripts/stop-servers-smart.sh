#!/bin/bash
# Smart Cross-Platform Server Stopper for SignHouse

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

# Kill process by PID file
kill_by_pidfile() {
    local pidfile="$1"
    local service_name="$2"

    if [[ -f "$pidfile" ]]; then
        local pid=$(cat "$pidfile")
        if [[ -n "$pid" && "$pid" != "0" ]]; then
            echo -e "${YELLOW}🔍 Found $service_name PID: $pid${NC}"

            if [[ "$SIGNHOUSE_OS" == "windows" ]]; then
                # Windows process killing
                if powershell -Command "Get-Process -Id $pid -ErrorAction SilentlyContinue" >/dev/null 2>&1; then
                    echo -e "${YELLOW}⚠️  Stopping $service_name (PID: $pid)${NC}"
                    powershell -Command "Stop-Process -Id $pid -Force" 2>/dev/null
                    echo -e "${GREEN}✅ $service_name stopped${NC}"
                else
                    echo -e "${BLUE}ℹ️  $service_name process $pid not running${NC}"
                fi
            else
                # Linux/Mac process killing
                if kill -0 "$pid" 2>/dev/null; then
                    echo -e "${YELLOW}⚠️  Stopping $service_name (PID: $pid)${NC}"
                    kill "$pid" 2>/dev/null
                    sleep 2

                    # Force kill if still running
                    if kill -0 "$pid" 2>/dev/null; then
                        echo -e "${YELLOW}💀 Force killing $service_name (PID: $pid)${NC}"
                        kill -9 "$pid" 2>/dev/null
                    fi
                    echo -e "${GREEN}✅ $service_name stopped${NC}"
                else
                    echo -e "${BLUE}ℹ️  $service_name process $pid not running${NC}"
                fi
            fi
        fi

        # Clean up PID file
        rm -f "$pidfile"
    else
        echo -e "${BLUE}ℹ️  No $service_name PID file found${NC}"
    fi
}

# Kill processes by port
kill_by_port() {
    local port="$1"
    local service_name="$2"

    echo -e "${YELLOW}🔍 Checking for processes on port $port ($service_name)...${NC}"

    if [[ "$SIGNHOUSE_OS" == "windows" ]]; then
        # Windows port-based killing
        local pids=$(netstat -ano 2>/dev/null | grep ":$port " | awk '{print $5}' | sort -u | grep -v "^0$")
        if [[ -n "$pids" ]]; then
            for pid in $pids; do
                if [[ "$pid" != "0" ]]; then
                    echo -e "${YELLOW}⚠️  Killing process $pid on port $port${NC}"
                    powershell -Command "Stop-Process -Id $pid -Force" 2>/dev/null || true
                fi
            done
            echo -e "${GREEN}✅ Processes on port $port stopped${NC}"
        else
            echo -e "${BLUE}ℹ️  No processes found on port $port${NC}"
        fi
    else
        # Linux/Mac port-based killing
        local pids=$(lsof -ti:$port 2>/dev/null)
        if [[ -n "$pids" ]]; then
            for pid in $pids; do
                echo -e "${YELLOW}⚠️  Killing process $pid on port $port${NC}"
                kill -9 "$pid" 2>/dev/null || true
            done
            echo -e "${GREEN}✅ Processes on port $port stopped${NC}"
        else
            echo -e "${BLUE}ℹ️  No processes found on port $port${NC}"
        fi
    fi
}

# Kill Node.js processes
kill_node_processes() {
    echo -e "${YELLOW}🔍 Looking for SignHouse Node.js processes...${NC}"

    if [[ "$SIGNHOUSE_OS" == "windows" ]]; then
        # Windows Node.js process cleanup
        local node_pids=$(powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like '*signhouse*' -or $_.CommandLine -like '*backend*' -or $_.CommandLine -like '*frontend*'} | Select-Object -ExpandProperty Id" 2>/dev/null)
        if [[ -n "$node_pids" ]]; then
            for pid in $node_pids; do
                echo -e "${YELLOW}⚠️  Killing Node.js process: $pid${NC}"
                powershell -Command "Stop-Process -Id $pid -Force" 2>/dev/null || true
            done
        fi
    else
        # Linux/Mac Node.js cleanup
        local node_pids=$(pgrep -f "node.*signhouse\|node.*backend\|node.*frontend" 2>/dev/null || true)
        if [[ -n "$node_pids" ]]; then
            for pid in $node_pids; do
                echo -e "${YELLOW}⚠️  Killing Node.js process: $pid${NC}"
                kill -9 "$pid" 2>/dev/null || true
            done
        fi
    fi
}

# Main stop function
main() {
    echo -e "${CYAN}🛑 SignHouse Smart Server Stopper${NC}"
    echo -e "${CYAN}==================================${NC}"
    echo ""

    # Check environment
    if [[ -z "$SIGNHOUSE_OS" ]]; then
        echo -e "${RED}❌ Environment detection failed. Running detect-environment.sh first...${NC}"
        source "$SCRIPT_DIR/detect-environment.sh" >/dev/null 2>&1
    fi

    echo -e "${BLUE}Environment: $SIGNHOUSE_OS${NC}"
    echo ""

    # Method 1: Kill by PID files (most reliable)
    echo -e "${BLUE}📋 Method 1: Stopping servers by PID files${NC}"
    kill_by_pidfile "/tmp/signhouse-backend.pid" "Backend Server"
    kill_by_pidfile "/tmp/signhouse-frontend.pid" "Frontend Server"

    echo ""

    # Method 2: Kill by ports (fallback)
    echo -e "${BLUE}🔌 Method 2: Stopping servers by ports${NC}"
    kill_by_port 3001 "Backend"
    kill_by_port 5173 "Frontend"

    echo ""

    # Method 3: Kill Node.js processes (nuclear option)
    echo -e "${BLUE}💣 Method 3: Cleanup Node.js processes${NC}"
    kill_node_processes

    # Clean up log files
    echo ""
    echo -e "${BLUE}🧹 Cleaning up log files${NC}"
    rm -f /tmp/signhouse-*.log 2>/dev/null || true
    rm -f /tmp/signhouse-*.pid 2>/dev/null || true
    echo -e "${GREEN}✅ Log files cleaned${NC}"

    # Final verification
    echo ""
    echo -e "${BLUE}🔍 Final verification${NC}"

    local backend_check=$(check_port 3001)
    local frontend_check=$(check_port 5173)

    if [[ "$backend_check" == "available" ]]; then
        echo -e "${GREEN}✅ Port 3001 (Backend): Available${NC}"
    else
        echo -e "${YELLOW}⚠️  Port 3001 (Backend): Still in use${NC}"
    fi

    if [[ "$frontend_check" == "available" ]]; then
        echo -e "${GREEN}✅ Port 5173 (Frontend): Available${NC}"
    else
        echo -e "${YELLOW}⚠️  Port 5173 (Frontend): Still in use${NC}"
    fi

    echo ""
    echo -e "${CYAN}🎉 Server shutdown complete!${NC}"
    echo ""
    echo -e "${YELLOW}💡 To start servers: ./infrastructure/scripts/start-servers-smart.sh${NC}"
    echo -e "${YELLOW}💡 To check status: ./infrastructure/scripts/status-servers.sh${NC}"
}

# Port availability check function
check_port() {
    local port="$1"

    if [[ "$SIGNHOUSE_OS" == "windows" ]]; then
        if netstat -an 2>/dev/null | grep -q ":${port} "; then
            echo "in-use"
        else
            echo "available"
        fi
    else
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

# Check if running directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi