#!/bin/bash
# Setup automated backup schedule using cron
# 4-tier backup system with proper timing

set -e

SCRIPT_DIR="/home/jon/Nexus"
BACKUP_SCRIPT="$SCRIPT_DIR/backup_system.sh"

echo "Setting up automated backup schedule..."

# Create cron job entries
CRON_JOBS="
# Sign Manufacturing Database Backups
# Daily backup at 2:00 AM
0 2 * * * $BACKUP_SCRIPT daily >> /var/log/sign_backup.log 2>&1

# Weekly backup on Sunday at 3:00 AM
0 3 * * 0 $BACKUP_SCRIPT weekly >> /var/log/sign_backup.log 2>&1

# Monthly backup on 1st day of month at 4:00 AM  
0 4 1 * * $BACKUP_SCRIPT monthly >> /var/log/sign_backup.log 2>&1

# Yearly backup on January 1st at 5:00 AM
0 5 1 1 * $BACKUP_SCRIPT yearly >> /var/log/sign_backup.log 2>&1

# Network backup to Windows PC daily at 6:00 AM
0 6 * * * $BACKUP_SCRIPT network >> /var/log/sign_backup.log 2>&1
"

# Function to install cron jobs
install_cron_jobs() {
    echo "Installing cron jobs for automated backups..."
    
    # Get current crontab, remove existing sign manufacturing entries, add new ones
    (crontab -l 2>/dev/null | grep -v "Sign Manufacturing\|backup_system.sh" || true; echo "$CRON_JOBS") | crontab -
    
    echo "Cron jobs installed successfully"
    echo "Current crontab:"
    crontab -l | grep -A 10 -B 2 "Sign Manufacturing" || echo "No Sign Manufacturing cron jobs found"
}

# Function to create log rotation configuration
setup_log_rotation() {
    echo "Setting up log rotation for backup logs..."
    
    cat > /tmp/sign_backup_logrotate << EOF
/var/log/sign_backup.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        # Send signal to rsyslog if needed
        /bin/kill -HUP \$(cat /var/run/rsyslogd.pid 2> /dev/null) 2> /dev/null || true
    endscript
}
EOF
    
    if [ -d "/etc/logrotate.d" ]; then
        sudo mv /tmp/sign_backup_logrotate /etc/logrotate.d/sign_backup
        echo "Log rotation configured successfully"
    else
        echo "Warning: /etc/logrotate.d not found, log rotation not configured"
        rm /tmp/sign_backup_logrotate
    fi
}

# Function to create monitoring script
create_backup_monitor() {
    echo "Creating backup monitoring script..."
    
    cat > "$SCRIPT_DIR/backup_monitor.sh" << 'EOF'
#!/bin/bash
# Backup monitoring and alerting script

BACKUP_BASE_DIR="/mnt/job-files/Backups"
LOG_FILE="/var/log/sign_backup.log"
ALERT_EMAIL="admin@yourcompany.com"  # Update this

# Check if backups are running successfully
check_backup_health() {
    local today=$(date +%Y%m%d)
    local yesterday=$(date -d "yesterday" +%Y%m%d)
    
    echo "=== Backup Health Check - $(date) ==="
    
    # Check if daily backup exists for today or yesterday
    if [ -f "$BACKUP_BASE_DIR/Daily/daily_sign_manufacturing_${today}"*.sql.gz ] || \
       [ -f "$BACKUP_BASE_DIR/Daily/daily_sign_manufacturing_${yesterday}"*.sql.gz ]; then
        echo "✓ Daily backup: OK"
    else
        echo "✗ Daily backup: MISSING"
        return 1
    fi
    
    # Check backup file sizes (should be > 1KB)
    for backup_dir in "$BACKUP_BASE_DIR/Daily" "$BACKUP_BASE_DIR/Weekly" "$BACKUP_BASE_DIR/Monthly"; do
        if [ -d "$backup_dir" ]; then
            local latest_backup=$(ls -t "$backup_dir"/*.sql.gz 2>/dev/null | head -1)
            if [ -n "$latest_backup" ] && [ -s "$latest_backup" ]; then
                local size=$(du -h "$latest_backup" | cut -f1)
                echo "✓ Latest backup in $(basename "$backup_dir"): $size"
            fi
        fi
    done
    
    # Check log for recent errors
    if [ -f "$LOG_FILE" ]; then
        local errors=$(grep -c "ERROR" "$LOG_FILE" | tail -1)
        if [ "$errors" -gt 0 ]; then
            echo "⚠ Found $errors errors in recent logs"
            echo "Recent errors:"
            grep "ERROR" "$LOG_FILE" | tail -5
        else
            echo "✓ No recent errors in backup logs"
        fi
    fi
    
    # Check disk space
    local disk_usage=$(df -h "$BACKUP_BASE_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 85 ]; then
        echo "⚠ Backup drive is ${disk_usage}% full - consider cleanup"
    else
        echo "✓ Disk space: ${disk_usage}% used"
    fi
    
    echo "=== Backup Health Check Complete ==="
}

# Email alert function
send_alert() {
    local message="$1"
    echo "$message" | mail -s "Sign Manufacturing Backup Alert" "$ALERT_EMAIL" 2>/dev/null || {
        echo "Failed to send email alert: $message"
    }
}

# Main monitoring function
main() {
    if ! check_backup_health; then
        send_alert "Backup system health check failed. Please review backup logs."
        exit 1
    fi
}

# Run if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
EOF
    
    chmod +x "$SCRIPT_DIR/backup_monitor.sh"
    echo "Backup monitoring script created: $SCRIPT_DIR/backup_monitor.sh"
    
    # Add monitoring to crontab (daily check at 8 AM)
    (crontab -l 2>/dev/null | grep -v "backup_monitor.sh" || true; echo "0 8 * * * $SCRIPT_DIR/backup_monitor.sh >> /var/log/sign_backup_monitor.log 2>&1") | crontab -
    echo "Added backup monitoring to crontab"
}

# Function to test backup system
test_backup_system() {
    echo "Testing backup system..."
    
    if [ ! -f "$BACKUP_SCRIPT" ]; then
        echo "ERROR: Backup script not found: $BACKUP_SCRIPT"
        return 1
    fi
    
    if [ ! -x "$BACKUP_SCRIPT" ]; then
        echo "ERROR: Backup script is not executable: $BACKUP_SCRIPT"
        return 1
    fi
    
    # Test script without actually running backup
    if bash -n "$BACKUP_SCRIPT"; then
        echo "✓ Backup script syntax is valid"
    else
        echo "✗ Backup script has syntax errors"
        return 1
    fi
    
    # Check if required directories exist
    if [ -d "/mnt/job-files" ]; then
        echo "✓ Job files directory exists"
    else
        echo "⚠ Job files directory not found - will be created during first backup"
    fi
    
    echo "Backup system test completed successfully"
}

# Main execution
main() {
    echo "Sign Manufacturing Backup Automation Setup"
    echo "=========================================="
    
    # Ensure backup script exists and is executable
    if [ ! -f "$BACKUP_SCRIPT" ]; then
        echo "ERROR: Backup script not found: $BACKUP_SCRIPT"
        echo "Please ensure backup_system.sh exists in $SCRIPT_DIR"
        exit 1
    fi
    
    if [ ! -x "$BACKUP_SCRIPT" ]; then
        chmod +x "$BACKUP_SCRIPT"
        echo "Made backup script executable"
    fi
    
    # Test backup system
    test_backup_system
    
    # Install cron jobs
    install_cron_jobs
    
    # Setup log rotation
    setup_log_rotation
    
    # Create monitoring script
    create_backup_monitor
    
    echo ""
    echo "Automated backup system setup completed!"
    echo ""
    echo "Backup Schedule:"
    echo "- Daily: 2:00 AM (kept for 30 days)"
    echo "- Weekly: Sunday 3:00 AM (kept for 12 weeks)" 
    echo "- Monthly: 1st of month 4:00 AM (kept for 24 months)"
    echo "- Yearly: January 1st 5:00 AM (kept indefinitely)"
    echo "- Network sync: Daily 6:00 AM"
    echo "- Health check: Daily 8:00 AM"
    echo ""
    echo "Logs: /var/log/sign_backup.log"
    echo "Monitor: $SCRIPT_DIR/backup_monitor.sh"
    echo ""
    echo "To manually run backups:"
    echo "$BACKUP_SCRIPT daily|weekly|monthly|yearly|network|all"
}

# Execute main function
main "$@"