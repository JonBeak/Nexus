#!/bin/bash
# Smart Cross-Platform Server Status Checker for SignHouse

# Source environment detection
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/detect-environment.sh" >/dev/null 2>&1

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Check if service is running by PID
check_service_by_pid() {
    local pidfile="$1"
    local service_name="$2"

    if [[ -f "$pidfile" ]]; then
        local pid=$(cat "$pidfile")
        if [[ -n "$pid" && "$pid" != "0" ]]; then
            if [[ "$SIGNHOUSE_OS" == "windows" ]]; then
                if powershell -Command "Get-Process -Id $pid -ErrorAction SilentlyContinue" >/dev/null 2>&1; then
                    echo -e "${GREEN}✅ $service_name: Running (PID: $pid)${NC}"
                    return 0
                else
                    echo -e "${RED}❌ $service_name: PID file exists but process not running${NC}"
                    return 1
                fi
            else
                if kill -0 "$pid" 2>/dev/null; then
                    echo -e "${GREEN}✅ $service_name: Running (PID: $pid)${NC}"
                    return 0
                else
                    echo -e "${RED}❌ $service_name: PID file exists but process not running${NC}"
                    return 1
                fi
            fi
        else
            echo -e "${RED}❌ $service_name: Invalid PID in file${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  $service_name: No PID file found${NC}"
        return 1
    fi
}

# Check if port is in use
check_port_status() {
    local port="$1"
    local service_name="$2"

    if [[ "$SIGNHOUSE_OS" == "windows" ]]; then
        local pid=$(netstat -ano 2>/dev/null | grep ":$port " | awk '{print $5}' | head -1)
        if [[ -n "$pid" && "$pid" != "0" ]]; then
            echo -e "${GREEN}✅ $service_name: Port $port in use (PID: $pid)${NC}"
            return 0
        else
            echo -e "${RED}❌ $service_name: Port $port available${NC}"
            return 1
        fi
    else
        if command -v netstat &> /dev/null; then
            local pid=$(netstat -tulpn 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | head -1)
            if [[ -n "$pid" ]]; then
                echo -e "${GREEN}✅ $service_name: Port $port in use (PID: $pid)${NC}"
                return 0
            fi
        elif command -v ss &> /dev/null; then
            local pid=$(ss -tulpn 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d',' -f2 | cut -d'=' -f2 | head -1)
            if [[ -n "$pid" ]]; then
                echo -e "${GREEN}✅ $service_name: Port $port in use (PID: $pid)${NC}"
                return 0
            fi
        fi

        echo -e "${RED}❌ $service_name: Port $port available${NC}"
        return 1
    fi
}

# Test HTTP endpoint
test_http_endpoint() {
    local url="$1"
    local service_name="$2"

    if command -v curl &> /dev/null; then
        if curl -s --connect-timeout 3 "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name: HTTP endpoint responding${NC}"
            return 0
        else
            echo -e "${RED}❌ $service_name: HTTP endpoint not responding${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  $service_name: curl not available, skipping HTTP test${NC}"
        return 1
    fi
}

# Main status function
main() {
    echo -e "${CYAN}📊 SignHouse Server Status${NC}"
    echo -e "${CYAN}==========================${NC}"
    echo ""

    # Check environment
    if [[ -z "$SIGNHOUSE_OS" ]]; then
        echo -e "${RED}❌ Environment detection failed. Running detect-environment.sh first...${NC}"
        source "$SCRIPT_DIR/detect-environment.sh" >/dev/null 2>&1
    fi

    echo -e "${BLUE}Environment: $SIGNHOUSE_OS${NC}"
    echo ""

    # Backend Status
    echo -e "${BLUE}🔧 Backend Server (Port 3001)${NC}"
    echo "================================"

    local backend_port_ok=false
    local backend_http_ok=false

    check_port_status 3001 "Backend Port" && backend_port_ok=true
    test_http_endpoint "http://localhost:3001/api/health" "Backend API" && backend_http_ok=true

    echo ""

    # Frontend Status
    echo -e "${BLUE}🎨 Frontend Server (Port 5173)${NC}"
    echo "================================="

    local frontend_port_ok=false
    check_port_status 5173 "Frontend Port" && frontend_port_ok=true

    echo ""

    # Overall Status Summary
    echo -e "${CYAN}📈 Overall Status Summary${NC}"
    echo "========================="

    if [[ "$backend_http_ok" == true && "$frontend_port_ok" == true ]]; then
        echo -e "${GREEN}🟢 System Status: HEALTHY${NC}"
        echo -e "   ${GREEN}✅ Backend API: Responding${NC}"
        echo -e "   ${GREEN}✅ Frontend: Running${NC}"
        echo -e "   ${GREEN}✅ Ready for use: http://localhost:5173${NC}"
    elif [[ "$backend_port_ok" == true && "$frontend_port_ok" == true ]]; then
        echo -e "${YELLOW}🟡 System Status: PARTIALLY HEALTHY${NC}"
        echo -e "   ${YELLOW}⚠️  Backend: Running but API may not be ready${NC}"
        echo -e "   ${GREEN}✅ Frontend: Running${NC}"
    elif [[ "$backend_port_ok" == true ]]; then
        echo -e "${YELLOW}🟡 System Status: BACKEND ONLY${NC}"
        echo -e "   ${GREEN}✅ Backend: Running${NC}"
        echo -e "   ${RED}❌ Frontend: Not running${NC}"
    elif [[ "$frontend_port_ok" == true ]]; then
        echo -e "${YELLOW}🟡 System Status: FRONTEND ONLY${NC}"
        echo -e "   ${RED}❌ Backend: Not running${NC}"
        echo -e "   ${GREEN}✅ Frontend: Running${NC}"
    else
        echo -e "${RED}🔴 System Status: DOWN${NC}"
        echo -e "   ${RED}❌ Backend: Not running${NC}"
        echo -e "   ${RED}❌ Frontend: Not running${NC}"
    fi

    echo ""
    echo -e "${CYAN}💡 Quick Actions${NC}"
    echo "================"
    echo -e "${YELLOW}🚀 Start servers: ./infrastructure/scripts/start-servers-smart.sh${NC}"
    echo -e "${YELLOW}🛑 Stop servers:  ./infrastructure/scripts/stop-servers-smart.sh${NC}"
    echo ""
}

# Check if running directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi