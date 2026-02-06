# System Operations Guide

Server management, dual-instance architecture, build/backup commands, dev workflow, and troubleshooting.
**Referenced from**: CLAUDE.md | **See also**: BUILD_MANAGEMENT.md (detailed backup procedures)

---

## Dual-Instance Architecture

Two backend instances run simultaneously — development never affects production.

| | Production | Development |
|---|---|---|
| **Port** | 3001 | 3002 |
| **Build Dir** | `dist-production/` | `dist-dev/` |
| **PM2 Name** | `signhouse-backend` | `signhouse-backend-dev` |
| **Frontend** | https://nexuswebapp.duckdns.org (Nginx) | http://192.168.2.14:5173 (Vite hot-reload) |

PM2 Config: `/home/jon/Nexus/backend/web/ecosystem.config.js`

---

## Server Management

All scripts located in `/home/jon/Nexus/infrastructure/scripts/`

| Action | Command |
|--------|---------|
| Start production | `start-production.sh` |
| Start development | `start-dev.sh` |
| Stop all servers | `stop-servers.sh` |
| Check status | `status-servers.sh` |

### View Logs

| Log | Command |
|-----|---------|
| Backend (prod) | `pm2 logs signhouse-backend` |
| Backend (dev) | `pm2 logs signhouse-backend-dev` |
| Frontend | `tail -f /tmp/signhouse-frontend.log` |

---

## Build Commands

| Action | Command |
|--------|---------|
| Rebuild dev backend | `backend-rebuild-dev.sh` |
| Rebuild prod backend | `backend-rebuild-production.sh` |
| Rebuild dev frontend | `frontend-rebuild-dev.sh` |
| Rebuild prod frontend | `frontend-rebuild-production.sh` |
| Restart dev (no rebuild) | `pm2 restart signhouse-backend-dev` |
| Restart prod (no rebuild) | `pm2 restart signhouse-backend` |

**NEVER** manually run `npm run build`, `mv dist`, or manipulate build folders. Always use the scripts above.

---

## Backup Commands

| Action | Command |
|--------|---------|
| Create backup | `backup-builds.sh` |
| List backups | `list-backups.sh` |
| Restore backup | `restore-backup.sh <filename>` |
| Cleanup old backups | `cleanup-backups.sh [count]` |

Weekly backups recommended. Backup metadata includes commit hash for exact version tracking.
See `/home/jon/Nexus/BUILD_MANAGEMENT.md` for detailed backup procedures.

---

## Development Workflow

1. Make code changes (frontend hot-reloads automatically via Vite)
2. For backend changes: run `backend-rebuild-dev.sh`
3. Test on http://192.168.2.14:5173 (talks to backend on port 3002)
4. Production on port 3001 remains untouched during development
5. When ready to deploy: run `backend-rebuild-production.sh`
6. Production immediately serves new code

---

## Database Access

| Setting | Value |
|---------|-------|
| Status check | `systemctl status mysql` |
| Credentials file | `/home/jon/Nexus/backend/web/.env` |
| Variables | `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` |
| Quick connect | `mysql -h $(grep DB_HOST .env) -u $(grep DB_USER .env) -p sign_manufacturing` |

**NEVER** use root. Always use the dedicated non-root user from `.env`.

---

## Utility Scripts

### QuickBooks Credential Update
```bash
node /home/jon/Nexus/backend/web/update-qb-credentials.js
```
Interactive CLI tool. QB credentials stored encrypted in database using AES-256-GCM.

---

## Troubleshooting

1. Check server status: `status-servers.sh`
2. Review logs: `/tmp/signhouse-*.log`
3. Verify database: `systemctl status mysql`
4. Check port conflicts: `lsof -i :3001` and `lsof -i :5173`
5. If rebuild doesn't update: Compare PM2 PID (`pm2 list`) with port PID (`lsof -i :3001`). If different, kill rogue process before restarting PM2.
6. Never modify backup files as fallback

---

## Known Issues

### Legacy Script: start-servers-smart.sh Uses Hardcoded Root
- **Status**: Known issue — awaiting refactoring
- `/infrastructure/scripts/start-servers-smart.sh` contains hardcoded MySQL credentials (`root:root`) for initial database setup
- Legacy from early development; current production uses `backend-rebuild-dev.sh` and `backend-rebuild-production.sh`
- **Fix**: When refactoring, update to source `.env` credentials

---

**Last Updated**: 2026-02-06
