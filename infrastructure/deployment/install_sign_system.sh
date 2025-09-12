#!/bin/bash
# Master installation script for Sign Manufacturing System
# Orchestrates the complete setup process

set -e

SCRIPT_DIR="/home/jon/Nexus"
LOG_FILE="/var/log/sign_system_install.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_success() {
    log "${GREEN}✓ $1${NC}"
}

log_warning() {
    log "${YELLOW}⚠ $1${NC}"
}

log_error() {
    log "${RED}✗ $1${NC}"
}

log_info() {
    log "${BLUE}ℹ $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking system prerequisites..."
    
    # Check OS
    if [[ ! -f /etc/os-release ]]; then
        log_error "Cannot determine operating system"
        return 1
    fi
    
    source /etc/os-release
    log_info "Detected OS: $PRETTY_NAME"
    
    # Check if running as non-root with sudo access
    if [[ $EUID -eq 0 ]]; then
        log_error "Do not run this script as root. Run as a regular user with sudo access."
        return 1
    fi
    
    # Check sudo access
    if ! sudo -n true 2>/dev/null; then
        log_info "Testing sudo access (you may be prompted for password)..."
        if ! sudo true; then
            log_error "Sudo access required but not available"
            return 1
        fi
    fi
    
    # Check internet connectivity
    if ! ping -c 1 google.com >/dev/null 2>&1; then
        log_warning "Internet connectivity check failed - some features may not work"
    else
        log_success "Internet connectivity verified"
    fi
    
    log_success "Prerequisites check completed"
}

# Function to install system dependencies
install_dependencies() {
    log_info "Installing system dependencies..."
    
    # Update package list
    sudo apt update
    
    # Install required packages
    local packages=(
        "mysql-server"
        "python3"
        "python3-pip"
        "python3-venv"
        "cron"
        "logrotate"
        "rsync"
        "curl"
        "wget"
        "unzip"
        "git"
        "mailutils"
    )
    
    for package in "${packages[@]}"; do
        if dpkg -l | grep -q "^ii  $package "; then
            log_info "$package already installed"
        else
            log_info "Installing $package..."
            sudo apt install -y "$package"
            log_success "$package installed"
        fi
    done
    
    # Install Python packages
    log_info "Installing Python packages..."
    pip3 install --user mysql-connector-python
    
    log_success "Dependencies installation completed"
}

# Function to secure MySQL installation
secure_mysql() {
    log_info "Configuring MySQL security..."
    
    # Check if MySQL is running
    if ! systemctl is-active --quiet mysql; then
        log_info "Starting MySQL service..."
        sudo systemctl start mysql
        sudo systemctl enable mysql
    fi
    
    log_info "MySQL service is running"
    
    # Run mysql_secure_installation with predefined answers
    log_info "Securing MySQL installation..."
    log_warning "You will be prompted to set up MySQL security settings"
    log_info "Recommended settings:"
    log_info "- Set a strong root password"
    log_info "- Remove anonymous users: Y"
    log_info "- Disallow root login remotely: Y"
    log_info "- Remove test database: Y"
    log_info "- Reload privilege tables: Y"
    
    sudo mysql_secure_installation
    
    log_success "MySQL security configuration completed"
}

# Function to set up external drive
setup_external_drive() {
    log_info "Setting up external drive for job files..."
    
    if [[ -f "$SCRIPT_DIR/setup_external_drive.sh" ]]; then
        log_info "External drive setup script found"
        log_info "Available storage devices:"
        lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE | grep -E "(disk|part)" | grep -v "^loop"
        
        echo
        read -p "Do you have an external USB drive connected? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Please specify the device (e.g., /dev/sdb1):"
            read -r device_path
            
            if [[ -b "$device_path" ]]; then
                log_info "Setting up external drive: $device_path"
                "$SCRIPT_DIR/setup_external_drive.sh" "$device_path"
                log_success "External drive setup completed"
            else
                log_error "Device not found: $device_path"
                log_warning "Skipping external drive setup - you can run it later"
            fi
        else
            log_info "Creating local job files directory as fallback"
            sudo mkdir -p /mnt/job-files
            sudo chown $USER:$USER /mnt/job-files
            log_warning "External drive not configured - using local storage"
        fi
    else
        log_error "External drive setup script not found"
        return 1
    fi
}

# Function to set up database
setup_database() {
    log_info "Setting up sign manufacturing database..."
    
    if [[ -f "$SCRIPT_DIR/database_setup.sh" ]]; then
        "$SCRIPT_DIR/database_setup.sh"
        log_success "Database setup completed"
    else
        log_error "Database setup script not found"
        return 1
    fi
}

# Function to configure backup system
setup_backups() {
    log_info "Configuring automated backup system..."
    
    if [[ -f "$SCRIPT_DIR/setup_cron_jobs.sh" ]]; then
        "$SCRIPT_DIR/setup_cron_jobs.sh"
        log_success "Backup system configured"
    else
        log_error "Backup configuration script not found"
        return 1
    fi
}

# Function to configure email system
setup_email_system() {
    log_info "Configuring email system..."
    
    # Create email configuration template
    if [[ ! -f "$SCRIPT_DIR/email_config.json" ]]; then
        cat > "$SCRIPT_DIR/email_config.json" << EOF
{
    "smtp_server": "smtp.gmail.com",
    "smtp_port": 587,
    "username": "your-email@gmail.com",
    "password": "your-app-password",
    "use_tls": true,
    "use_ssl": false
}
EOF
        chmod 600 "$SCRIPT_DIR/email_config.json"
        log_info "Email configuration template created: $SCRIPT_DIR/email_config.json"
        log_warning "Please update email_config.json with your SMTP settings"
    fi
    
    log_success "Email system setup completed"
}

# Function to create server recovery documentation
create_recovery_docs() {
    log_info "Creating server recovery documentation..."
    
    cat > "$SCRIPT_DIR/SERVER_RECOVERY.md" << 'EOF'
# Sign Manufacturing System - Server Recovery Guide

## Complete System Recovery Process

### 1. Hardware Replacement/New Server Setup

```bash
# Install Ubuntu Server (same version as original)
# Update system
sudo apt update && sudo apt upgrade -y

# Clone this repository
git clone <your-repo-url> /home/jon/Nexus
cd /home/jon/Nexus

# Run master installation script
./install_sign_system.sh
```

### 2. Database Recovery

```bash
# Restore from latest backup
cd /home/jon/Nexus

# Find latest backup
ls -la /mnt/job-files/Backups/*/

# Restore database
mysql -u root -p sign_manufacturing < /path/to/latest_backup.sql

# Verify restoration
./database_maintenance.sh
```

### 3. Job Files Recovery

```bash
# Mount external drive
sudo mount /dev/sdX1 /mnt/job-files

# Verify job files
ls -la /mnt/job-files/Orders/

# Set permissions
sudo chown -R $USER:signmanufacturing /mnt/job-files
chmod -R 775 /mnt/job-files
```

### 4. Service Restoration

```bash
# Start services
sudo systemctl start mysql
sudo systemctl enable mysql

# Verify cron jobs
crontab -l

# Test backup system
./backup_system.sh daily

# Test email system
python3 email_system.py
```

### 5. Configuration Files to Backup/Restore

- `/home/jon/Nexus/database_config.json`
- `/home/jon/Nexus/email_config.json`
- `/etc/mysql/mysql.conf.d/mysqld.cnf`
- `/etc/fstab` (for drive mounting)
- Crontab entries (`crontab -l`)

### 6. Verification Checklist

- [ ] MySQL service running
- [ ] Database accessible with correct data
- [ ] External drive mounted and accessible
- [ ] Job files directory structure intact
- [ ] Backup system running (check logs)
- [ ] Email system configured and tested
- [ ] Cron jobs scheduled correctly
- [ ] Network connectivity working
- [ ] All scripts executable and in place

### 7. Contact Information

System Administrator: [YOUR NAME]
Email: [YOUR EMAIL]
Phone: [YOUR PHONE]

### 8. Important File Locations

- Database backups: `/mnt/job-files/Backups/`
- Job files: `/mnt/job-files/Orders/`
- System scripts: `/home/jon/Nexus/`
- Log files: `/var/log/sign_*.log`
- Configuration: `/home/jon/Nexus/*.json`

### 9. Emergency Contacts

- MySQL Issues: Database administrator
- Network Issues: IT support
- Hardware Issues: Hardware vendor
- Backup Issues: System administrator
EOF

    chmod 644 "$SCRIPT_DIR/SERVER_RECOVERY.md"
    log_success "Server recovery documentation created: $SCRIPT_DIR/SERVER_RECOVERY.md"
}

# Function to run post-installation tests
run_tests() {
    log_info "Running post-installation tests..."
    
    # Test MySQL connection
    if systemctl is-active --quiet mysql; then
        log_success "MySQL service is running"
    else
        log_error "MySQL service is not running"
    fi
    
    # Test database connection
    if [[ -f "$SCRIPT_DIR/database_config.json" ]]; then
        local db_user=$(grep -o '"user": "[^"]*"' "$SCRIPT_DIR/database_config.json" | cut -d'"' -f4)
        local db_password=$(grep -o '"password": "[^"]*"' "$SCRIPT_DIR/database_config.json" | cut -d'"' -f4)
        
        if mysql -u "$db_user" -p"$db_password" sign_manufacturing -e "SELECT 1;" >/dev/null 2>&1; then
            log_success "Database connection test passed"
        else
            log_error "Database connection test failed"
        fi
    else
        log_warning "Database configuration not found"
    fi
    
    # Test job files directory
    if [[ -d "/mnt/job-files" ]]; then
        if [[ -w "/mnt/job-files" ]]; then
            log_success "Job files directory is writable"
        else
            log_warning "Job files directory is not writable"
        fi
    else
        log_error "Job files directory not found"
    fi
    
    # Test backup system
    if [[ -x "$SCRIPT_DIR/backup_system.sh" ]]; then
        log_success "Backup system script is executable"
    else
        log_error "Backup system script is not executable"
    fi
    
    # Test cron jobs
    if crontab -l | grep -q "backup_system.sh"; then
        log_success "Backup cron jobs are configured"
    else
        log_warning "Backup cron jobs not found"
    fi
    
    log_info "Post-installation tests completed"
}

# Function to display completion summary
show_completion_summary() {
    log_info "=== Installation Summary ==="
    
    echo
    echo "Sign Manufacturing System Installation Complete!"
    echo "=============================================="
    echo
    echo "Installed Components:"
    echo "✓ MySQL Database Server"
    echo "✓ Sign Manufacturing Database Schema"
    echo "✓ Automated Backup System (4-tier retention)"
    echo "✓ Email Communication System"
    echo "✓ Job File Storage System"
    echo "✓ Server Recovery Documentation"
    echo
    echo "Key File Locations:"
    echo "- Scripts: $SCRIPT_DIR/"
    echo "- Database config: $SCRIPT_DIR/database_config.json"
    echo "- Email config: $SCRIPT_DIR/email_config.json"
    echo "- Job files: /mnt/job-files/Orders/"
    echo "- Backups: /mnt/job-files/Backups/"
    echo "- Logs: /var/log/sign_*.log"
    echo
    echo "Next Steps:"
    echo "1. Update company details in database (system_config table)"
    echo "2. Configure SMTP settings in $SCRIPT_DIR/email_config.json"
    echo "3. Set up network share for Windows PC backup"
    echo "4. Migrate data from existing Excel workbooks"
    echo "5. Build web interfaces for daily operations"
    echo "6. Train staff on new system"
    echo
    echo "Backup Schedule:"
    echo "- Daily: 2:00 AM (30 days retention)"
    echo "- Weekly: Sunday 3:00 AM (12 weeks retention)"
    echo "- Monthly: 1st of month 4:00 AM (24 months retention)"
    echo "- Yearly: January 1st 5:00 AM (indefinite retention)"
    echo
    echo "For support, see: $SCRIPT_DIR/SERVER_RECOVERY.md"
    echo
}

# Main installation function
main() {
    echo "Sign Manufacturing System - Master Installation"
    echo "=============================================="
    
    # Create log file
    sudo touch "$LOG_FILE"
    sudo chown $USER:$USER "$LOG_FILE"
    
    log_info "Starting installation process..."
    
    # Run installation steps
    check_prerequisites || { log_error "Prerequisites check failed"; exit 1; }
    
    install_dependencies || { log_error "Dependencies installation failed"; exit 1; }
    
    secure_mysql || { log_error "MySQL security configuration failed"; exit 1; }
    
    setup_external_drive || { log_warning "External drive setup had issues"; }
    
    setup_database || { log_error "Database setup failed"; exit 1; }
    
    setup_backups || { log_error "Backup system setup failed"; exit 1; }
    
    setup_email_system || { log_error "Email system setup failed"; exit 1; }
    
    create_recovery_docs || { log_error "Recovery documentation creation failed"; exit 1; }
    
    run_tests || { log_warning "Some tests failed - please review"; }
    
    show_completion_summary
    
    log_success "Installation completed successfully!"
}

# Trap to ensure cleanup on exit
cleanup() {
    log_info "Installation script completed"
}
trap cleanup EXIT

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi