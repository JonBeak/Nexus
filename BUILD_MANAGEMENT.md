# Build Management Guide

> **For detailed documentation, workflows, and troubleshooting, see [BUILD_MANAGEMENT_DETAILED.md](BUILD_MANAGEMENT_DETAILED.md)**

## System Overview

Nexus uses a **dual-instance architecture** where production and development backends run simultaneously:

| Environment | Backend Port | Build Directory | PM2 Process | Frontend |
|-------------|--------------|-----------------|-------------|----------|
| **Production** | 3001 | `dist-production/` | `signhouse-backend` | `nexuswebapp.duckdns.org` (Nginx) |
| **Development** | 3002 | `dist-dev/` | `signhouse-backend-dev` | `192.168.2.14:5173` (Vite) |

- Both backends run from PM2 using `/backend/web/ecosystem.config.js`
- Each instance runs from its own build directory (no symlink switching needed)
- Development changes don't affect production until you explicitly rebuild production

All scripts located in: `/home/jon/Nexus/infrastructure/scripts/`

---

## Quick Command Reference

### Server Management
```bash
start-production.sh    # Start both backends + build frontend for Nginx
start-dev.sh          # Start both backends + Vite dev server
stop-servers.sh       # Stop all servers
status-servers.sh     # Check status of all instances
```

### Build Management
```bash
# Backend (rebuilds and restarts the appropriate PM2 instance)
backend-rebuild-dev.sh        # Rebuild dist-dev + restart signhouse-backend-dev
backend-rebuild-production.sh # Rebuild dist-production + restart signhouse-backend

# Frontend
frontend-rebuild-dev.sh       # Rebuild frontend dev
frontend-rebuild-production.sh # Rebuild frontend production

# Both (unified)
rebuild-dev.sh        # Rebuild both backend + frontend dev
rebuild-production.sh # Rebuild both backend + frontend production
```

### PM2 Commands
```bash
pm2 list                           # See both instances
pm2 logs signhouse-backend         # Production backend logs
pm2 logs signhouse-backend-dev     # Dev backend logs
pm2 restart signhouse-backend      # Restart production only
pm2 restart signhouse-backend-dev  # Restart dev only
pm2 restart all                    # Restart both
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

### Day-to-Day Development

1. **Frontend changes** - Vite hot-reloads automatically on port 5173
2. **Backend changes** - Run `backend-rebuild-dev.sh` to rebuild and restart dev instance
3. **Test** - Access `http://192.168.2.14:5173` (talks to backend on port 3002)
4. **Production stays untouched** - Port 3001 continues serving stable code

### Deploying to Production

When you're ready to push changes to production:

```bash
# 1. Create a backup first
backup-builds.sh

# 2. Rebuild production backend
backend-rebuild-production.sh

# 3. Rebuild production frontend (if frontend changes)
frontend-rebuild-production.sh

# 4. Verify
status-servers.sh
```

Production is now live with your changes at `https://nexuswebapp.duckdns.org`

---

## Common Workflows

### Backend-Only Update
```bash
# 1. Make backend code changes
# 2. Rebuild and test on dev
backend-rebuild-dev.sh
# 3. Test on port 3002
# 4. Deploy to production
backup-builds.sh
backend-rebuild-production.sh
```

### Frontend-Only Update
```bash
# 1. Make frontend code changes (hot-reload on 5173)
# 2. When ready, rebuild production frontend
frontend-rebuild-production.sh
# Nginx automatically serves the new build
```

### Full Stack Update
```bash
# 1. Make all changes
# 2. Test on dev (5173 + 3002)
backend-rebuild-dev.sh
# 3. Deploy to production
backup-builds.sh
rebuild-production.sh
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

# 5. Verify
status-servers.sh
```

---

## Best Practices

**DO:**
- Test on dev (5173 + 3002) before deploying to production
- Create backups before major production changes
- Use `status-servers.sh` to verify both instances are running
- Keep last 10 backups minimum
- Run `backup-builds.sh` weekly

**DON'T:**
- Manually run `npm run build` - use the scripts
- Modify files in `/infrastructure/backups/`
- Forget that production (3001) and dev (3002) are separate instances

---

## Troubleshooting

### Instance not starting
```bash
# Check PM2 status
pm2 status

# Check logs for errors
pm2 logs signhouse-backend --lines 50
pm2 logs signhouse-backend-dev --lines 50

# Restart from ecosystem config
cd /home/jon/Nexus/backend/web
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

### Build doesn't exist
```bash
# Rebuild the missing build
backend-rebuild-dev.sh     # For dev
backend-rebuild-production.sh  # For production
```

### Port already in use
```bash
# Check what's using the port
lsof -i :3001  # Production
lsof -i :3002  # Dev

# Kill rogue process if needed
kill -9 <PID>
```

### Frontend not connecting to correct backend
```bash
# Check .env.development (should point to 3002)
cat /home/jon/Nexus/frontend/web/.env.development
# Should show: VITE_API_URL=http://192.168.2.14:3002/api

# Check .env.production (should point to production URL)
cat /home/jon/Nexus/frontend/web/.env.production
# Should show: VITE_API_URL=https://nexuswebapp.duckdns.org/api
```

---

## Technical Notes

- **PM2 Config**: `/home/jon/Nexus/backend/web/ecosystem.config.js`
- **Frontend Dev Env**: `.env.development` points to port 3002
- **Frontend Prod Env**: `.env.production` points to `nexuswebapp.duckdns.org`
- **Backups** stored in `/home/jon/Nexus/infrastructure/backups/`
- **Backup format**: `dist-{production|dev}-YYYYMMDD-HHMMSS-commit-{hash}.tar.gz`
- **Typical sizes**: Backend ~500KB, Frontend ~400KB (compressed)

---

## View Logs
```bash
# Backend Production
pm2 logs signhouse-backend

# Backend Development
pm2 logs signhouse-backend-dev

# Frontend Dev Server
tail -f /tmp/signhouse-frontend.log

# Nginx
sudo tail -f /var/log/nginx/signhouse-error.log
```
