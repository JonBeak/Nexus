#!/bin/bash
# External USB Drive Setup for Sign Manufacturing System
# This script configures external drive mounting and creates job file structure

set -e

echo "Sign Manufacturing - External Drive Setup"
echo "========================================"

# Function to detect USB drives
detect_usb_drives() {
    echo "Detecting available USB drives..."
    lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE | grep -E "(disk|part)" | grep -v "^loop"
    echo ""
    echo "Available USB devices:"
    ls -la /dev/disk/by-id/ | grep -i usb || echo "No USB drives detected"
}

# Function to create mount point
create_mount_point() {
    local mount_point="/mnt/job-files"
    
    if [ ! -d "$mount_point" ]; then
        echo "Creating mount point: $mount_point"
        sudo mkdir -p "$mount_point"
        sudo chown $USER:$USER "$mount_point"
        echo "Mount point created successfully"
    else
        echo "Mount point already exists: $mount_point"
    fi
}

# Function to create job file directory structure
create_job_structure() {
    local base_path="/mnt/job-files"
    local current_year=$(date +%Y)
    local current_month=$(date +%m)
    
    echo "Creating job file directory structure..."
    
    # Create base directories
    mkdir -p "$base_path/Orders"
    mkdir -p "$base_path/Templates"
    mkdir -p "$base_path/Archive"
    mkdir -p "$base_path/Backups"
    
    # Create current year/month structure
    mkdir -p "$base_path/Orders/$current_year/$current_month"
    
    # Create template directories
    mkdir -p "$base_path/Templates/Estimates"
    mkdir -p "$base_path/Templates/Work_Orders"
    mkdir -p "$base_path/Templates/Invoices"
    
    echo "Directory structure created successfully"
    echo "Base path: $base_path"
    echo "Current orders path: $base_path/Orders/$current_year/$current_month"
}

# Function to configure automatic mounting
configure_auto_mount() {
    local device="$1"
    local mount_point="/mnt/job-files"
    local fs_type="$2"
    
    echo "Configuring automatic mounting..."
    
    # Get UUID of the device
    local uuid=$(sudo blkid "$device" | grep -o 'UUID="[^"]*"' | cut -d'"' -f2)
    
    if [ -z "$uuid" ]; then
        echo "Warning: Could not determine UUID for $device"
        return 1
    fi
    
    echo "Device UUID: $uuid"
    
    # Backup current fstab
    sudo cp /etc/fstab /etc/fstab.backup.$(date +%Y%m%d_%H%M%S)
    
    # Add entry to fstab
    local fstab_entry="UUID=$uuid $mount_point $fs_type defaults,user,rw,auto 0 2"
    
    if ! grep -q "$uuid" /etc/fstab; then
        echo "Adding entry to /etc/fstab: $fstab_entry"
        echo "$fstab_entry" | sudo tee -a /etc/fstab
    else
        echo "Entry already exists in /etc/fstab"
    fi
}

# Function to mount the drive
mount_drive() {
    local device="$1"
    local mount_point="/mnt/job-files"
    
    echo "Mounting $device to $mount_point..."
    
    # Unmount if already mounted
    if mountpoint -q "$mount_point"; then
        echo "Drive already mounted, unmounting first..."
        sudo umount "$mount_point"
    fi
    
    # Mount the drive
    sudo mount "$device" "$mount_point"
    
    if mountpoint -q "$mount_point"; then
        echo "Drive mounted successfully"
        df -h "$mount_point"
    else
        echo "Failed to mount drive"
        return 1
    fi
}

# Function to set permissions
set_permissions() {
    local mount_point="/mnt/job-files"
    
    echo "Setting permissions..."
    sudo chown -R $USER:$USER "$mount_point"
    chmod -R 755 "$mount_point"
    
    # Set up group permissions for multi-user access
    sudo groupadd -f signmanufacturing
    sudo usermod -a -G signmanufacturing $USER
    sudo chgrp -R signmanufacturing "$mount_point"
    chmod -R g+rw "$mount_point"
    
    echo "Permissions set for multi-user access"
}

# Function to test the setup
test_setup() {
    local mount_point="/mnt/job-files"
    local test_file="$mount_point/test_write.tmp"
    
    echo "Testing drive access..."
    
    # Test write access
    echo "Test file created at $(date)" > "$test_file"
    if [ -f "$test_file" ]; then
        echo "Write test successful"
        rm "$test_file"
    else
        echo "Write test failed"
        return 1
    fi
    
    # Display disk usage
    echo "Disk usage:"
    df -h "$mount_point"
}

# Main execution
main() {
    echo "Starting external drive setup..."
    
    # Detect available drives
    detect_usb_drives
    
    # Create mount point
    create_mount_point
    
    echo ""
    echo "Manual steps required:"
    echo "1. Connect your external USB drive"
    echo "2. Identify the device (e.g., /dev/sdb1) from the list above"
    echo "3. Run this script with the device parameter:"
    echo "   ./setup_external_drive.sh /dev/sdb1"
    echo ""
    
    if [ $# -eq 1 ]; then
        local device="$1"
        
        if [ ! -b "$device" ]; then
            echo "Error: Device $device not found"
            exit 1
        fi
        
        # Detect filesystem type
        local fs_type=$(sudo blkid "$device" | grep -o 'TYPE="[^"]*"' | cut -d'"' -f2)
        if [ -z "$fs_type" ]; then
            echo "Warning: Could not detect filesystem type. Assuming ext4."
            fs_type="ext4"
        fi
        
        echo "Device: $device"
        echo "Filesystem: $fs_type"
        echo ""
        
        # Mount the drive
        mount_drive "$device"
        
        # Create directory structure
        create_job_structure
        
        # Set permissions
        set_permissions
        
        # Configure automatic mounting
        configure_auto_mount "$device" "$fs_type"
        
        # Test the setup
        test_setup
        
        echo ""
        echo "External drive setup completed successfully!"
        echo "Job files will be stored in: /mnt/job-files/Orders"
        
    fi
}

# Run main function
main "$@"