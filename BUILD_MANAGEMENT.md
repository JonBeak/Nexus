# Build Management Guide

> **For detailed documentation, workflows, and troubleshooting, see [BUILD_MANAGEMENT_DETAILED.md](BUILD_MANAGEMENT_DETAILED.md)**

## System Overview

Nexus uses a **dual-build architecture** where production and development builds coexist safely:
- **Backend**: `/backend/web/dist` → symlink to `dist-production/` or `dist-dev/`
- **Frontend**: `/frontend/web/dist` → symlink to `dist-production/` or `dist-dev/`
- **PM2** runs whichever build the symlink points to

All scripts located in: `/home/jon/Nexus/infrastructure/scripts/`

---

## Quick Command Reference

### Server Management
```bash
start-production.sh    # Start with production builds
start-dev.sh          # Start with dev builds
stop-servers.sh       # Stop all servers
status-servers.sh     # Check status and active builds
```

### Build Management
```bash
build-status.sh       # Check which builds are active

# Unified (backend + frontend together)
rebuild-dev.sh        # Rebuild both dev builds
rebuild-production.sh # Rebuild both production builds
switch-to-dev.sh      # Switch both to dev
switch-to-production.sh # Switch both to production

# Individual (backend OR frontend only)
backend-rebuild-dev.sh        # Rebuild backend dev only
backend-switch-to-dev.sh      # Switch backend to dev only
frontend-rebuild-dev.sh       # Rebuild frontend dev only
frontend-switch-to-dev.sh     # Switch frontend to dev only
```

### Backup Management
```bash
backup-builds.sh           # Backup all current builds
list-backups.sh           # List available backups
restore-backup.sh <file>  # Restore specific backup
cleanup-backups.sh [N]    # Keep last N backups (default: 10)
```

---

## Development Workflow

### Frontend Development
**Use hot-reload - do NOT rebuild**

1. Ensure dev server is running: `start-dev.sh`
2. Make frontend code changes
3. Changes appear automatically in browser

### Backend Development
**Requires rebuild after changes**

Quick rebuild command:
```bash
backend-rebuild-dev.sh && backend-switch-to-dev.sh
```

Steps:
1. Make backend code changes
2. Run: `backend-rebuild-dev.sh && backend-switch-to-dev.sh`
3. Backend automatically restarts via PM2
4. Test changes immediately

---

## Common Workflows

### Testing New Features (Dev → Production)
```bash
# 1. Create backup
backup-builds.sh

# 2. Make code changes, then rebuild dev
rebuild-dev.sh

# 3. Switch to dev and restart
switch-to-dev.sh
stop-servers.sh && start-dev.sh

# 4. Test thoroughly

# 5. If good, promote to production
rebuild-production.sh
switch-to-production.sh
stop-servers.sh && start-production.sh
```

### Backend-Only Update
```bash
# 1. Backup first
backup-builds.sh

# 2. Make backend changes, rebuild and switch
backend-rebuild-dev.sh && backend-switch-to-dev.sh

# 3. Test backend (frontend stays on current build)

# 4. If good, promote to production
backend-rebuild-production.sh
backend-switch-to-production.sh
```

### Emergency Rollback
```bash
# 1. List available backups
list-backups.sh

# 2. Stop servers
stop-servers.sh

# 3. Restore backup
restore-backup.sh <backup-filename>

# 4. Start servers
start-production.sh

# 5. Verify in browser
```

### Switching Between Builds (No Rebuild)
```bash
# Switch to dev
switch-to-dev.sh
stop-servers.sh && start-dev.sh

# Switch to production
switch-to-production.sh
stop-servers.sh && start-production.sh

# Check status
build-status.sh
```

---

## Best Practices

✅ **DO:**
- Test in dev before promoting to production
- Create backups before major changes
- Use `backend-rebuild-dev.sh` for quick backend iterations
- Keep last 10 backups minimum
- Check `build-status.sh` after switching

❌ **DON'T:**
- Rebuild frontend during development (use hot-reload)
- Skip dev testing phase
- Modify files in `/infrastructure/backups/`
- Forget to restart servers after switching builds

---

## Troubleshooting

### Build doesn't exist
```bash
# Rebuild the missing build
rebuild-dev.sh          # or
rebuild-production.sh
```

### Server won't start
```bash
# Check status
build-status.sh
status-servers.sh

# Check logs
pm2 logs signhouse-backend
tail -f /tmp/signhouse-frontend.log

# Verify builds exist
ls -la /home/jon/Nexus/backend/web/dist*/
ls -la /home/jon/Nexus/frontend/web/dist*/
```

### Symlink broken
```bash
# Check symlink
readlink /home/jon/Nexus/backend/web/dist

# Manual fix (backend example)
cd /home/jon/Nexus/backend/web
rm dist
ln -s dist-production dist
```

### Backup restore failed
```bash
# Verify backup exists
list-backups.sh

# Check integrity
tar -tzf /home/jon/Nexus/infrastructure/backups/backend-builds/<backup-file> > /dev/null

# Manual restore (backend example)
cd /home/jon/Nexus/backend/web
tar -xzf /home/jon/Nexus/infrastructure/backups/backend-builds/<backup-file>
```

### Disk space low
```bash
# Aggressive cleanup (keep last 5)
cleanup-backups.sh 5

# Check sizes
list-backups.sh
```

---

## Technical Notes

- **Symlinks** allow instant switching without rebuilding
- **PM2** automatically picks up changes after restart
- **Vite** hot-reload works only in dev mode (port 5173)
- **Backups** stored in `/home/jon/Nexus/infrastructure/backups/`
- **Backup format**: `dist-{production|dev}-YYYYMMDD-HHMMSS-commit-{hash}.tar.gz`
- **Typical sizes**: Backend ~500KB, Frontend ~400KB (compressed)

---

## View Logs
```bash
# Backend
pm2 logs signhouse-backend

# Frontend
tail -f /tmp/signhouse-frontend.log
```
