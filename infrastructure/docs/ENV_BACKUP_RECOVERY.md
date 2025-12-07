# Environment File Backup Recovery

## What's Backed Up
- `backend/web/.env` - Database credentials, JWT secrets, encryption salt
- `frontend/web/.env` - Frontend configuration

## Download from Google Drive

### Option 1: Using rclone (if available)
```bash
rclone copy gdrive:Nexus/config/env-backup.tar.gz.gpg /tmp/
```

### Option 2: Manual Download
1. Go to https://drive.google.com
2. Navigate to `Nexus/config/`
3. Download `env-backup.tar.gz.gpg`

## Decrypt and Extract

```bash
# Navigate to where you downloaded the file
cd /tmp

# Decrypt and extract (will prompt for password)
gpg --pinentry-mode loopback -d env-backup.tar.gz.gpg | tar xzf -

# Files will be extracted to:
#   home/jon/Nexus/backend/web/.env
#   home/jon/Nexus/frontend/web/.env
```

## Copy to Correct Location

```bash
# Copy to new server/location
cp home/jon/Nexus/backend/web/.env /home/jon/Nexus/backend/web/.env
cp home/jon/Nexus/frontend/web/.env /home/jon/Nexus/frontend/web/.env

# Clean up extracted files
rm -rf home/
rm env-backup.tar.gz.gpg
```

## If GPG Prompts Fail

If you see "Inappropriate ioctl for device", use:
```bash
gpg --pinentry-mode loopback -d env-backup.tar.gz.gpg | tar xzf -
```

## Creating a New Backup

```bash
tar czf - /home/jon/Nexus/backend/web/.env /home/jon/Nexus/frontend/web/.env | \
  gpg --symmetric --cipher-algo AES256 --pinentry-mode loopback -o /tmp/env-backup.tar.gz.gpg

rclone copy /tmp/env-backup.tar.gz.gpg gdrive:Nexus/config/
rm /tmp/env-backup.tar.gz.gpg
```
