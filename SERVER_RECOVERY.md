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
