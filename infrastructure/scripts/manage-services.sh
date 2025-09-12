#!/bin/bash
# Sign House - Manage services script

set -e

SERVICES=("signhouse-backend" "signhouse-frontend")

show_status() {
    echo "📊 Sign House Services Status:"
    echo "================================"
    for service in "${SERVICES[@]}"; do
        echo "🔍 $service:"
        sudo systemctl status "$service" --no-pager -l || echo "   ❌ Service not found or stopped"
        echo ""
    done
}

start_services() {
    echo "🚀 Starting Sign House services..."
    for service in "${SERVICES[@]}"; do
        echo "  Starting $service..."
        sudo systemctl start "$service"
    done
    echo "✅ Services started!"
}

stop_services() {
    echo "🛑 Stopping Sign House services..."
    for service in "${SERVICES[@]}"; do
        echo "  Stopping $service..."
        sudo systemctl stop "$service"
    done
    echo "✅ Services stopped!"
}

restart_services() {
    echo "🔄 Restarting Sign House services..."
    for service in "${SERVICES[@]}"; do
        echo "  Restarting $service..."
        sudo systemctl restart "$service"
    done
    echo "✅ Services restarted!"
}

enable_services() {
    echo "⚙️  Enabling Sign House services for auto-start..."
    for service in "${SERVICES[@]}"; do
        echo "  Enabling $service..."
        sudo systemctl enable "$service"
    done
    echo "✅ Services enabled for auto-start!"
}

disable_services() {
    echo "⚙️  Disabling Sign House services auto-start..."
    for service in "${SERVICES[@]}"; do
        echo "  Disabling $service..."
        sudo systemctl disable "$service"
    done
    echo "✅ Services disabled from auto-start!"
}

show_logs() {
    local service="$1"
    if [ -z "$service" ]; then
        echo "Please specify a service: backend or frontend"
        exit 1
    fi
    
    if [ "$service" = "backend" ]; then
        sudo journalctl -u signhouse-backend -f
    elif [ "$service" = "frontend" ]; then
        sudo journalctl -u signhouse-frontend -f
    else
        echo "Invalid service. Use 'backend' or 'frontend'"
        exit 1
    fi
}

case "$1" in
    status)
        show_status
        ;;
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    enable)
        enable_services
        ;;
    disable)
        disable_services
        ;;
    logs)
        show_logs "$2"
        ;;
    *)
        echo "Sign House Service Manager"
        echo "========================="
        echo "Usage: $0 {status|start|stop|restart|enable|disable|logs}"
        echo ""
        echo "Commands:"
        echo "  status    - Show status of all services"
        echo "  start     - Start all services"
        echo "  stop      - Stop all services"
        echo "  restart   - Restart all services"
        echo "  enable    - Enable auto-start on boot"
        echo "  disable   - Disable auto-start on boot"
        echo "  logs SERVICE - Show live logs (backend or frontend)"
        echo ""
        echo "Examples:"
        echo "  $0 status"
        echo "  $0 logs backend"
        echo "  $0 logs frontend"
        exit 1
        ;;
esac