#!/bin/bash
#
# Database Backup to Google Drive
# Backs up MySQL database and uploads to Google Drive via rclone
#
# Usage: ./backup-db-to-gdrive.sh [--keep-local N] [--keep-remote N]
#
# Options:
#   --keep-local N   Keep last N local backups (default: 7)
#   --keep-remote N  Keep last N remote backups (default: 30)
#

set -e

# ============================================================================
# Configuration
# ============================================================================

# Paths
NEXUS_DIR="/home/jon/Nexus"
BACKUP_DIR="/home/jon/Nexus/infrastructure/backups/database"
ENV_FILE="/home/jon/Nexus/backend/web/.env"
LOG_FILE="/home/jon/Nexus/infrastructure/logs/db-backup.log"

# Database (loaded from .env)
DB_HOST="localhost"
DB_USER="webuser"
DB_PASSWORD="webpass123"
DB_NAME="sign_manufacturing"

# rclone remote and destination folder
RCLONE_REMOTE="gdrive"
GDRIVE_FOLDER="Nexus/backups/database"

# Retention defaults
KEEP_LOCAL=7
KEEP_REMOTE=30

# ============================================================================
# Parse Arguments
# ============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --keep-local)
            KEEP_LOCAL="$2"
            shift 2
            ;;
        --keep-remote)
            KEEP_REMOTE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ============================================================================
# Functions
# ============================================================================

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" >> "$LOG_FILE"
    echo "[$timestamp] $1" >&2
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

ensure_dirs() {
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"
}

create_backup() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local filename="sign_manufacturing_${timestamp}.sql.gz"
    local filepath="${BACKUP_DIR}/${filename}"
    local sql_filepath="${BACKUP_DIR}/sign_manufacturing_${timestamp}.sql"

    log "Creating database backup: $filename"

    # Step 1: Dump to uncompressed SQL file first (safer than piping)
    # Note: --routines removed due to privilege issues with stored procedures
    # Triggers and events are included; stored procedures can be recreated if needed
    mysqldump \
        --host="$DB_HOST" \
        --user="$DB_USER" \
        --password="$DB_PASSWORD" \
        --single-transaction \
        --triggers \
        --events \
        --no-tablespaces \
        "$DB_NAME" > "$sql_filepath" 2>/dev/null || true

    # Verify file was created and has content
    if [[ ! -s "$sql_filepath" ]]; then
        rm -f "$sql_filepath"
        error_exit "mysqldump failed - no output file created"
    fi

    # Step 2: Verify backup is complete by checking for key tables
    if ! grep -q "CREATE TABLE \`users\`" "$sql_filepath"; then
        rm -f "$sql_filepath"
        error_exit "Backup incomplete - missing users table"
    fi

    if ! grep -q "CREATE TABLE \`customers\`" "$sql_filepath"; then
        rm -f "$sql_filepath"
        error_exit "Backup incomplete - missing customers table"
    fi

    # Step 3: Count tables and verify reasonable number
    local table_count=$(grep -c "CREATE TABLE" "$sql_filepath" || echo 0)
    if [[ $table_count -lt 30 ]]; then
        rm -f "$sql_filepath"
        error_exit "Backup incomplete - only $table_count tables found (expected 30+)"
    fi
    log "Backup contains $table_count tables"

    # Step 4: Compress the verified SQL file
    if ! gzip "$sql_filepath"; then
        rm -f "$sql_filepath" "$filepath"
        error_exit "gzip compression failed"
    fi

    if [[ ! -s "$filepath" ]]; then
        rm -f "$filepath"
        error_exit "Backup file is empty or failed to create"
    fi

    local size=$(du -h "$filepath" | cut -f1)
    log "Backup created: $filename ($size)"

    echo "$filepath"
}

upload_to_gdrive() {
    local filepath="$1"
    local filename=$(basename "$filepath")

    log "Uploading to Google Drive: ${RCLONE_REMOTE}:${GDRIVE_FOLDER}/"

    # Ensure remote directory exists
    rclone mkdir "${RCLONE_REMOTE}:${GDRIVE_FOLDER}" 2>/dev/null || true

    # Upload
    if rclone copy "$filepath" "${RCLONE_REMOTE}:${GDRIVE_FOLDER}/" --quiet; then
        log "Upload completed"
    else
        error_exit "Upload failed"
    fi

    # Verify upload
    if rclone ls "${RCLONE_REMOTE}:${GDRIVE_FOLDER}/${filename}" &>/dev/null; then
        log "Upload verified: $filename"
        return 0
    else
        error_exit "Upload verification failed for $filename"
    fi
}

cleanup_local() {
    log "Cleaning up local backups (keeping last $KEEP_LOCAL)"

    local count=$(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l)

    if [[ $count -gt $KEEP_LOCAL ]]; then
        local to_delete=$((count - KEEP_LOCAL))
        ls -1t "$BACKUP_DIR"/*.sql.gz | tail -n "$to_delete" | while read file; do
            log "  Removing old local backup: $(basename "$file")"
            rm -f "$file"
        done
    else
        log "  No local cleanup needed ($count backups exist)"
    fi
}

cleanup_remote() {
    log "Cleaning up remote backups (keeping last $KEEP_REMOTE)"

    # List remote files sorted by name (timestamp in name = chronological)
    local remote_files=$(rclone lsf "${RCLONE_REMOTE}:${GDRIVE_FOLDER}/" --files-only 2>/dev/null | sort)
    local count=$(echo "$remote_files" | grep -c . || echo 0)

    if [[ $count -gt $KEEP_REMOTE ]]; then
        local to_delete=$((count - KEEP_REMOTE))
        echo "$remote_files" | head -n "$to_delete" | while read file; do
            log "  Removing old remote backup: $file"
            rclone delete "${RCLONE_REMOTE}:${GDRIVE_FOLDER}/${file}" 2>/dev/null || true
        done
    else
        log "  No remote cleanup needed ($count backups exist)"
    fi
}

# ============================================================================
# Main
# ============================================================================

main() {
    log "=========================================="
    log "Starting database backup to Google Drive"
    log "=========================================="

    ensure_dirs

    # Create backup
    local backup_file=$(create_backup)

    # Upload to Google Drive
    upload_to_gdrive "$backup_file"

    # Cleanup old backups
    cleanup_local
    cleanup_remote

    log "=========================================="
    log "Backup complete!"
    log "=========================================="
}

main "$@"
