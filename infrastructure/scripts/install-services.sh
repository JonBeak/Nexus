#!/bin/bash
# Sign House - Install systemd services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "🔧 Installing Sign House systemd services..."

# Copy service files to systemd directory
sudo cp "$REPO_DIR/infrastructure/systemd/signhouse-backend.service" /etc/systemd/system/
sudo cp "$REPO_DIR/infrastructure/systemd/signhouse-frontend.service" /etc/systemd/system/

# Set proper permissions
sudo chmod 644 /etc/systemd/system/signhouse-backend.service
sudo chmod 644 /etc/systemd/system/signhouse-frontend.service

# Reload systemd
sudo systemctl daemon-reload

echo "✅ Services installed successfully!"
echo ""
echo "Next steps:"
echo "  sudo systemctl enable signhouse-backend signhouse-frontend"
echo "  sudo systemctl start signhouse-backend signhouse-frontend"
echo ""
echo "To check status:"
echo "  sudo systemctl status signhouse-backend"
echo "  sudo systemctl status signhouse-frontend"